import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  ClassificationInput,
  ClassificationOutput,
  DesignGuidanceItem,
  DimensionRationale,
  ModifierScores,
  PredictabilityLevel,
  PredictabilityMetrics,
  SystemProfilePayload
} from 'psf-toolkit-core/dist/contracts.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Gemini client (required: fail fast if API key is not configured)
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  // eslint-disable-next-line no-console
  console.error('Missing GEMINI_API_KEY environment variable. Set it before starting the API server.');
  process.exit(1);
}
if (geminiApiKey.length < 20) {
  // eslint-disable-next-line no-console
  console.warn('Warning: GEMINI_API_KEY seems too short. Please verify it is correct.');
}

const geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = genAI.getGenerativeModel({ model: geminiModelName });
// eslint-disable-next-line no-console
console.log(`Gemini API initialized (model: ${geminiModelName})`);

// Simple helper: map a single scalar score to a PSF level based on the table thresholds
function scoreToLevel(pOverall: number): PredictabilityLevel {
  if (pOverall >= 0.9) return 1;
  if (pOverall >= 0.65) return 2;
  if (pOverall >= 0.35) return 3;
  if (pOverall >= 0.15) return 4;
  return 5;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Compute empirical P_t distribution from response samples.
 * Returns a Map from output string to probability.
 */
function computeEmpiricalDistribution(samples: string[]): Map<string, number> {
  const n = samples.length;
  const counts = new Map<string, number>();
  for (const s of samples) {
    const trimmed = s.trim();
    if (trimmed) {
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  const P_t = new Map<string, number>();
  counts.forEach((count, output) => {
    P_t.set(output, count / n);
  });
  return P_t;
}

/**
 * Construct Q_t^u (user mental model) distribution from user expectations.
 * If expectedOutput is provided, assign high probability to it and distribute remaining mass.
 * If expectedVariation is provided, use it to shape the distribution.
 */
function constructQ_t_u(
  P_t: Map<string, number>,
  userExpectations: { expectedOutput?: string; expectedVariation?: number },
  actualResponse?: string
): Map<string, number> {
  const Q_t_u = new Map<string, number>();
  const omega = Array.from(P_t.keys());
  const n = omega.length;
  
  if (userExpectations.expectedOutput) {
    // User provided expected output: assign high probability to it
    const expected = userExpectations.expectedOutput.trim();
    const epsilon = 0.01; // Additive smoothing parameter (small)
    
    // Find closest match in Ω (exact match or most similar)
    let bestMatch = expected;
    let bestMatchFound = false;
    for (const x of omega) {
      if (x.toLowerCase() === expected.toLowerCase()) {
        bestMatch = x;
        bestMatchFound = true;
        break;
      }
    }
    
    // If no exact match, use the expected string as a new outcome
    if (!bestMatchFound && expected) {
      bestMatch = expected;
    }
    
    // Construct Q_t^u: high probability on expected, low on others
    // Use expectedVariation to control concentration
    const concentration = userExpectations.expectedVariation !== undefined
      ? 1 - userExpectations.expectedVariation // Low variation = high concentration
      : 0.8; // Default: high concentration on expected
    
    const p_expected = Math.max(0.1, Math.min(0.95, concentration));
    const p_others = (1 - p_expected) / Math.max(1, n - 1);
    
    for (const x of omega) {
      if (x === bestMatch || x.toLowerCase() === bestMatch.toLowerCase()) {
        Q_t_u.set(x, p_expected);
      } else {
        Q_t_u.set(x, p_others);
      }
    }
    
    // If expected is not in Ω, add it
    if (!omega.includes(bestMatch) && bestMatch) {
      Q_t_u.set(bestMatch, p_expected);
      // Redistribute others
      const remaining = 1 - p_expected;
      const othersCount = omega.length;
      for (const x of omega) {
        if (x !== bestMatch && x.toLowerCase() !== bestMatch.toLowerCase()) {
          Q_t_u.set(x, remaining / othersCount);
        }
      }
    }
  } else {
    // No expected output: use uniform distribution as baseline
    const uniform = 1 / Math.max(1, n);
    for (const x of omega) {
      Q_t_u.set(x, uniform);
    }
  }
  
  // Apply additive smoothing: Q_{t,smooth}^u(x) = (1-ε) Q_t^u(x) + ε/|Ω|
  const epsilon = 0.01;
  const smoothed = new Map<string, number>();
  const uniformMass = epsilon / Math.max(1, Q_t_u.size);
  Q_t_u.forEach((q, x) => {
    smoothed.set(x, (1 - epsilon) * q + uniformMass);
  });
  
  // Normalize to ensure sum = 1
  let sum = 0;
  smoothed.forEach(q => { sum += q; });
  if (sum > 0) {
    const normalized = new Map<string, number>();
    smoothed.forEach((q, x) => {
      normalized.set(x, q / sum);
    });
    return normalized;
  }
  
  return smoothed;
}

/**
 * Compute C using exact formula from paper Section 2.2:
 * C = Σ_{x∈E_t} P_t(x) Q_t^u(x) / Σ_{x∈E_t} P_t(x)
 * where E_t = {x : P_t(x) ≥ θ} and θ is the median probability mass.
 */
function computeCExact(P_t: Map<string, number>, Q_t_u: Map<string, number>): number | null {
  if (P_t.size === 0) return null;
  
  // Compute median probability mass (θ)
  const probs = Array.from(P_t.values()).sort((a, b) => b - a);
  const medianIdx = Math.floor(probs.length / 2);
  const theta = probs[medianIdx];
  
  // E_t = {x : P_t(x) ≥ θ}
  const E_t = new Set<string>();
  P_t.forEach((p, x) => {
    if (p >= theta) {
      E_t.add(x);
    }
  });
  
  if (E_t.size === 0) return 0;
  
  // Compute numerator: Σ_{x∈E_t} P_t(x) Q_t^u(x)
  let numerator = 0;
  let denominator = 0;
  
  E_t.forEach(x => {
    const p = P_t.get(x) || 0;
    const q = Q_t_u.get(x) || 0; // If x not in Q_t^u, assume 0
    numerator += p * q;
    denominator += p;
  });
  
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Compute L using exact formula from paper Section 2.2:
 * L = exp(-λ · D_KL(P_t || Q_{t,smooth}^u))
 * where λ = 1/H_max and D_KL is KL divergence.
 */
function computeLExact(P_t: Map<string, number>, Q_t_u_smooth: Map<string, number>): number | null {
  if (P_t.size === 0) return null;
  
  // Compute H_max = log₂(|Ω|)
  const H_max = Math.log2(P_t.size || 1);
  if (H_max === 0) return 1; // Deterministic case
  
  const lambda = 1 / H_max;
  
  // Compute KL divergence: D_KL(P || Q) = Σ P(x) log₂(P(x) / Q(x))
  let kl = 0;
  let hasValidKL = false;
  
  P_t.forEach((p, x) => {
    if (p > 0) {
      const q = Q_t_u_smooth.get(x) || 0.0001; // Additive smoothing: avoid log(0)
      if (q > 0) {
        kl += p * Math.log2(p / q);
        hasValidKL = true;
      }
    }
  });
  
  if (!hasValidKL) return null;
  
  // L = exp(-λ · D_KL)
  const L = Math.exp(-lambda * kl);
  return Math.max(0, Math.min(1, L)); // Clamp to [0,1]
}

function computeModifiers(profile?: SystemProfilePayload): ModifierScores {
  // Baseline modifiers roughly aligned with a Level 2–3 surface.
  let O = 0.6;
  let I = 0.5;
  let X = 0.5;
  let Lp = 0.8;
  let F = 0.6;
  let S = 0.6;
  let A = 0.5;
  let D = 0.4;

  if (!profile) {
    return { O, I, X, Lp, F, S, A, D };
  }

  // Stakes: higher stakes demand stronger safety posture and usually more observability.
  if (profile.stakes === 'high') {
    S = clamp01(S + 0.25);
    O = clamp01(O + 0.1);
  } else if (profile.stakes === 'low') {
    S = clamp01(S - 0.1);
  }

  // User expertise: novice users benefit from higher observability and feedback responsiveness.
  if (profile.expertise === 'novice') {
    O = clamp01(O + 0.1);
    F = clamp01(F + 0.1);
  } else if (profile.expertise === 'expert') {
    // Experts can sometimes tolerate lower O if they have other cues.
    O = clamp01(O - 0.05);
  }

  // UI features mapped directly to modifier traits.
  if (profile.confidenceBadges) {
    // Confidence badges and explicit uncertainty cues increase observability.
    O = clamp01(O + 0.15);
  }

  if (profile.interruptButton) {
    // An explicit interrupt/abort surface strongly increases controllability.
    I = clamp01(I + 0.2);
  }

  if (profile.safeMode) {
    // Safe mode / conservative mode suggests stronger safety posture.
    S = clamp01(S + 0.2);
  }

  if (profile.rationaleView) {
    // Showing reasoning traces increases observability and, to a lesser extent, social alignment.
    O = clamp01(O + 0.1);
    A = clamp01(A + 0.05);
  }

  return { O, I, X, Lp, F, S, A, D };
}

function computeGuidance(
  level: PredictabilityLevel,
  dims: { T: number; C: number; L: number },
  modifiers: ModifierScores,
  profile?: SystemProfilePayload
): DesignGuidanceItem[] {
  const items: DesignGuidanceItem[] = [];
  const stakes = profile?.stakes ?? 'medium';
  const expertise = profile?.expertise ?? 'intermediate';

  // Interface / explanation guidance by level
  if (level === 1 || level === 2) {
    items.push({
      id: 'l1-2-interface-baseline',
      level,
      category: 'interface',
      title: 'Keep surfaces simple and deterministic',
      summary:
        'Expose stable, rule-like behavior with clear boundaries; prioritize speed and low cognitive load over rich explanations.',
    });
  } else if (level === 3) {
    items.push({
      id: 'l3-expert-controls',
      level,
      category: 'interface',
      title: 'Gate advanced behaviors behind expertise-sensitive controls',
      summary:
        'Use mode switches or expert panels to concentrate more unpredictable behaviors where expert users can configure and monitor them.',
    });
  } else if (level === 4) {
    items.push({
      id: 'l4-scaffolds',
      level,
      category: 'interface',
      title: 'Add scaffolds and safe defaults',
      summary:
        'Provide guardrails such as default safe actions, checklists, and recovery options when Level 4 behavior is unavoidable.',
    });
  } else if (level === 5) {
    items.push({
      id: 'l5-advisory-surface',
      level,
      category: 'interface',
      title: 'Treat the system as advisory only',
      summary:
        'Present outputs as suggestions that require human review; avoid fully automated actions when behavior is effectively open-ended.',
    });
  }

  // Trust / safety guidance from modifiers + stakes
  if (stakes === 'high' || modifiers.S < 0.7) {
    items.push({
      id: 'safety-high-stakes',
      level,
      category: 'trust',
      title: 'Strengthen safety posture for high-stakes use',
      summary:
        'Introduce confirmations, escalation paths, and clear responsibility handoffs when the domain is safety-critical or S is below the desired threshold.',
    });
  }

  // Observability and explanations
  if (modifiers.O < 0.7) {
    items.push({
      id: 'observability-boost',
      level,
      category: 'explanation',
      title: 'Increase observability of reasoning and limits',
      summary:
        'Surface uncertainty cues, brief rationales, and “why this?” overlays so users can see how outputs were produced and when not to rely on them.',
    });
  }

  // Expertise-sensitive transitions
  if (expertise === 'novice' && level >= 3) {
    items.push({
      id: 'novice-transition',
      level,
      category: 'transition',
      title: 'Provide novice-friendly pathways into higher levels',
      summary:
        'Offer guided tours, examples, and gradually unlocked capabilities so novice users can transition into Level 3+ behavior without being overwhelmed.',
    });
  }

  return items;
}

function computeTemporalMetricsFromSamples(samples?: string[]): Pick<
  PredictabilityMetrics,
  'temporalEntropy' | 'temporalVariationRate'
> {
  if (!samples || samples.length === 0) {
    return {};
  }

  const n = samples.length;
  const counts = new Map<string, number>();
  let validCount = 0; // Count of non-empty samples
  for (const s of samples) {
    const trimmed = s.trim();
    if (trimmed) {
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
      validCount++;
    }
  }

  // If no valid samples, return empty
  if (validCount === 0) {
    return {};
  }

  const distinct = counts.size;
  const temporalVariationRate = distinct / n;

  // Shannon entropy over discrete outputs, normalized to [0,1].
  // Use validCount (not n) as denominator so probabilities sum to 1
  let entropy = 0;
  counts.forEach(count => {
    const p = count / validCount;
    entropy -= p * Math.log2(p);
  });
  const maxEntropy = Math.log2(distinct || 1);
  const temporalEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return {
    temporalEntropy,
    temporalVariationRate
  };
}

async function classifyWithGemini(input: ClassificationInput, samples = 1): Promise<{
  level?: number;
  T?: number;
  C?: number;
  L?: number;
  note?: string;
  temporalStability?: number;
  rationale?: DimensionRationale;
}> {
  const sysDesc = input.systemDescription || 'Unspecified system';
  const prompt = input.prompt || '';
  const response = input.response || '';

  const instruction = `You are an HCI researcher evaluating the predictability of an AI system along three dimensions:
- Temporal predictability T: stability of outputs for similar inputs over time.
- Confidence predictability C: how clearly the system communicates its uncertainty and calibration.
- Learning predictability L: how easily users can build a reliable mental model of the system's behavior over repeated use.

Given the following description of an AI system, a user prompt, and an example response (if any), estimate T, C, and L as real numbers between 0 and 1, and suggest an overall predictability level between 1 and 5 (1 = fully predictable, 5 = fully unpredictable).

Also provide a PSF-style rationale explaining why each dimension received its score.

CRITICAL: Respond with ONLY a valid JSON object. Do NOT wrap it in markdown code blocks, do NOT add any text before or after. Start with { and end with }.

The JSON must have this exact shape:
{"level": <number>, "T": <number>, "C": <number>, "L": <number>, "note": "<explanation>", "rationale": {"overall": "<overall reason>", "T": "<why T>", "C": "<why C>", "L": "<why L>", "cues": ["<textual cue 1>", "<textual cue 2>"]}}`;

  const content = [
    instruction,
    `System description: ${sysDesc}`,
    `User prompt: ${prompt}`,
    `Example response: ${response || '(none provided)'}`
  ].join('\n');

  const parsedRuns: {
    level?: number;
    T?: number;
    C?: number;
    L?: number;
    note?: string;
    rationale?: DimensionRationale;
  }[] = [];

  for (let i = 0; i < samples; i += 1) {
    try {
      const result = await geminiModel.generateContent(content);
      let text = result.response.text().trim();
      
      // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      text = text.trim();
      
      try {
        const parsed = JSON.parse(text) as {
          level?: number;
          T?: number;
          C?: number;
          L?: number;
          note?: string;
          rationale?: DimensionRationale;
        };
        parsedRuns.push(parsed);
      } catch (parseError) {
        console.error(`Failed to parse Gemini response (attempt ${i + 1}):`, text.substring(0, 300));
        // Try to extract JSON from the text if it's embedded
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as {
              level?: number;
              T?: number;
              C?: number;
              L?: number;
              note?: string;
              rationale?: DimensionRationale;
            };
            parsedRuns.push(parsed);
          } catch {
            // If extraction also fails, skip this sample
            if (i === 0) {
              // Don't expose technical error to user, just return empty
              return {};
            }
          }
        } else {
          if (i === 0) {
            // Don't expose technical error to user, just return empty
            return {};
          }
        }
      }
    } catch (apiError: any) {
      const errorMsg = apiError?.message || apiError?.toString() || 'Unknown error';
      console.error(`Gemini API error (attempt ${i + 1}):`, errorMsg);
      if (i === 0) {
        throw apiError; // Re-throw to be caught by outer handler
      }
      // Skip this sample and continue
    }
  }

  if (parsedRuns.length === 0) {
    return {};
  }

  const base = parsedRuns[0];

  // Simple temporal stability proxy: how similar are T scores across repeated classifications.
  let temporalStability: number | undefined;
  if (parsedRuns.length > 1 && parsedRuns.every(r => typeof r.T === 'number')) {
    const tValues = parsedRuns.map(r => r.T as number);
    const maxT = Math.max(...tValues);
    const minT = Math.min(...tValues);
    const range = maxT - minT; // in [0, 1]
    temporalStability = Math.max(0, Math.min(1, 1 - range)); // 1 = perfectly stable, 0 = highly unstable
  }

  return {
    ...base,
    temporalStability
  };
}

app.post('/api/classify', async (req, res) => {
  const input = req.body as ClassificationInput;

  // Default heuristic scores
  let dims = {
    T: 0.8,
    C: 0.7,
    L: 0.6
  };
  let notes: string[] = [];

  // Use Gemini to refine T, C, L and level (with simple temporal stability estimate)
  let level: PredictabilityLevel = 2;
  let geminiRationale: DimensionRationale | undefined;
  let temporalStabilityFromClassifier: number | undefined;
  
  // Determine how many responses to classify
  // If we have multiple response samples, classify a subset to get averaged results
  const responseSamples = input.responseSamples || [];
  const numSamplesToClassify = responseSamples.length > 1
    ? Math.min(10, responseSamples.length) // Classify up to 10 responses for averaging
    : 1; // Single classification if no samples or only one sample
  
  try {
    if (numSamplesToClassify > 1) {
      // Multi-response classification: classify each response and average results
      const classificationResults: Array<{
        T?: number;
        C?: number;
        L?: number;
        level?: number;
        rationale?: DimensionRationale;
      }> = [];
      
      // Classify each response sample (up to the limit)
      for (let i = 0; i < numSamplesToClassify; i++) {
        try {
          const sampleInput: ClassificationInput = {
            ...input,
            response: responseSamples[i], // Use this specific response
            responseSamples: undefined // Don't pass all samples to individual classification
          };
          const result = await classifyWithGemini(sampleInput, 1);
          if (result.T !== undefined && result.C !== undefined && result.L !== undefined) {
            classificationResults.push({
              T: result.T,
              C: result.C,
              L: result.L,
              level: result.level,
              rationale: result.rationale
            });
          }
        } catch (err: any) {
          console.error(`Error classifying response ${i + 1}/${numSamplesToClassify}:`, err?.message);
          // Continue with other responses
        }
      }
      
      if (classificationResults.length > 0) {
        // Average T, C, L across all classifications
        const avgT = classificationResults.reduce((sum, r) => sum + (r.T || 0), 0) / classificationResults.length;
        const avgC = classificationResults.reduce((sum, r) => sum + (r.C || 0), 0) / classificationResults.length;
        const avgL = classificationResults.reduce((sum, r) => sum + (r.L || 0), 0) / classificationResults.length;
        
        dims = {
          T: Math.max(0, Math.min(1, avgT)),
          C: Math.max(0, Math.min(1, avgC)),
          L: Math.max(0, Math.min(1, avgL))
        };
        
        // Compute temporal stability from variance in T scores
        const tValues = classificationResults.map(r => r.T || 0);
        const maxT = Math.max(...tValues);
        const minT = Math.min(...tValues);
        const range = maxT - minT;
        temporalStabilityFromClassifier = Math.max(0, Math.min(1, 1 - range));
        
        // Blend averaged T with temporal stability
        const blendedT = 0.7 * dims.T + 0.3 * temporalStabilityFromClassifier;
        dims.T = Math.max(0, Math.min(1, blendedT));
        
        // Average level (round to nearest integer)
        const avgLevel = classificationResults
          .filter(r => r.level !== undefined)
          .reduce((sum, r) => sum + (r.level || 2), 0) / classificationResults.filter(r => r.level !== undefined).length;
        level = Math.min(5, Math.max(1, Math.round(avgLevel))) as PredictabilityLevel;
        
        // Use rationale from first classification (or merge if needed)
        geminiRationale = classificationResults[0]?.rationale;
        
        notes.push(
          `Averaged classification across ${classificationResults.length} response samples. Temporal stability: ${temporalStabilityFromClassifier.toFixed(2)}`
        );
      } else {
        // Fallback: single classification if all multi-classifications failed
        const geminiResult = await classifyWithGemini(input, 1);
        if (geminiResult.T !== undefined && geminiResult.C !== undefined && geminiResult.L !== undefined) {
          dims = {
            T: geminiResult.T,
            C: geminiResult.C,
            L: geminiResult.L
          };
        }
        if (geminiResult.level !== undefined) {
          level = Math.min(5, Math.max(1, Math.round(geminiResult.level))) as PredictabilityLevel;
        }
        geminiRationale = geminiResult.rationale;
        notes.push('Multi-response classification failed; using single classification.');
      }
    } else {
      // Single classification (no samples or only one sample)
      const geminiResult = await classifyWithGemini(input, 1);
      if (geminiResult.T !== undefined && geminiResult.C !== undefined && geminiResult.L !== undefined) {
        dims = {
          T: geminiResult.T,
          C: geminiResult.C,
          L: geminiResult.L
        };
      }
      if (geminiResult.temporalStability !== undefined && dims.T !== undefined) {
        // Blend Gemini's T estimate with a simple stability proxy across repeated classifications.
        const blendedT = 0.7 * dims.T + 0.3 * geminiResult.temporalStability;
        dims.T = Math.max(0, Math.min(1, blendedT));
        notes.push(
          `Temporal stability proxy from repeated classification: ${geminiResult.temporalStability.toFixed(
            2
          )}`
        );
        temporalStabilityFromClassifier = geminiResult.temporalStability;
      }

      if (geminiResult.level !== undefined) {
        const clamped = Math.min(5, Math.max(1, Math.round(geminiResult.level)));
        level = clamped as PredictabilityLevel;
      } else {
        const overallHeuristic = (dims.T + dims.C + dims.L) / 3;
        level = scoreToLevel(overallHeuristic);
      }
      if (geminiResult.note) {
        notes.push(geminiResult.note);
      }
      if (geminiResult.rationale) {
        geminiRationale = geminiResult.rationale;
      }
    }
  } catch (err: any) {
    const errorMsg = err?.message || err?.toString() || 'Unknown error';
    console.error('Gemini classification error:', errorMsg);
    notes.push(`Gemini classification failed: ${errorMsg}. Falling back to heuristic scores.`);
  }

  const overall = (dims.T + dims.C + dims.L) / 3;

  // Use ALL response samples for entropy and exact formulas (even if we only classified a subset)
  const allResponseSamples = input.responseSamples || [];
  const metricsFromSamples = computeTemporalMetricsFromSamples(allResponseSamples);
  
  // Compute empirical P_t distribution from ALL samples if available
  const P_t = allResponseSamples.length > 0
    ? computeEmpiricalDistribution(allResponseSamples)
    : null;
  
  // Use Q_t^u data (user expectations) to refine C and L if available
  if (input.userExpectations) {
    // For C (Confidence Predictability): Use exact formula when P_t is available
    if (P_t && input.userExpectations.expectedVariation !== undefined) {
      // Construct Q_t^u distribution from user expectations
      const Q_t_u = constructQ_t_u(P_t, input.userExpectations, input.response);
      
      // Compute C using exact formula: C = Σ_{x∈E_t} P_t(x) Q_t^u(x) / Σ_{x∈E_t} P_t(x)
      const C_exact = computeCExact(P_t, Q_t_u);
      
      if (C_exact !== null) {
        // Blend with Gemini's estimate (50% exact, 50% Gemini) for robustness
        dims.C = 0.5 * dims.C + 0.5 * C_exact;
        dims.C = Math.max(0, Math.min(1, dims.C));
        notes.push(`C computed using exact formula (paper Section 2.2): ${C_exact.toFixed(3)}`);
      } else {
        // Fallback to alignment proxy if exact computation fails
        const expectedVar = input.userExpectations.expectedVariation;
        const actualVar = metricsFromSamples.temporalVariationRate;
        if (actualVar !== undefined) {
          const alignment = 1 - Math.abs(expectedVar - actualVar);
          dims.C = 0.7 * dims.C + 0.3 * alignment;
          dims.C = Math.max(0, Math.min(1, dims.C));
          notes.push(`C refined using alignment proxy: expected variation ${expectedVar.toFixed(2)} vs actual ${actualVar.toFixed(2)}`);
        }
      }
    }

    // For L (Learning Predictability): Use exact KL divergence formula when P_t and Q_t^u are available
    if (P_t && input.userExpectations.expectedOutput && input.response) {
      // Construct Q_t^u distribution from expected output
      const Q_t_u = constructQ_t_u(P_t, input.userExpectations, input.response);
      
      // Compute L using exact formula: L = exp(-λ · D_KL(P_t || Q_{t,smooth}^u))
      const L_exact = computeLExact(P_t, Q_t_u);
      
      if (L_exact !== null) {
        // Blend with Gemini's estimate (50% exact, 50% Gemini) for robustness
        dims.L = 0.5 * dims.L + 0.5 * L_exact;
        dims.L = Math.max(0, Math.min(1, dims.L));
        notes.push(`L computed using exact KL divergence formula (paper Section 2.2): ${L_exact.toFixed(3)}`);
      } else {
        // Fallback to Jaccard similarity proxy if exact computation fails
        const expectedWords = new Set(input.userExpectations.expectedOutput.toLowerCase().split(/\s+/));
        const actualWords = new Set(input.response.toLowerCase().split(/\s+/));
        const intersection = new Set([...expectedWords].filter(x => actualWords.has(x)));
        const union = new Set([...expectedWords, ...actualWords]);
        const similarity = union.size > 0 ? intersection.size / union.size : 0;
        dims.L = 0.6 * dims.L + 0.4 * similarity;
        dims.L = Math.max(0, Math.min(1, dims.L));
        notes.push(`L refined using Jaccard similarity proxy: ${similarity.toFixed(2)}`);
      }
    }
  }
  const metrics: PredictabilityMetrics = {
    ...metricsFromSamples,
    temporalStabilityFromClassifier
  };

  const modifiers = computeModifiers(input.profile);
  const guidance = computeGuidance(level, dims, modifiers, input.profile);

  const output: ClassificationOutput = {
    level,
    dimensions: dims,
    overallScore: overall,
    modifiers,
    metrics,
    rationale: geminiRationale,
    guidance,
    notes,
    version: '0.1.0'
  };

  res.json(output);
});

app.post('/api/generate-responses', async (req, res) => {
  const { prompt, systemDescription, count = 5 } = req.body as {
    prompt: string;
    systemDescription?: string;
    count?: number;
  };

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  const responses: string[] = [];
  const sysDesc = systemDescription || 'Unspecified system';

  // Generate multiple responses by calling Gemini with the probe prompt
  // This simulates what the evaluated system might produce
  const instruction = `You are simulating responses from an AI system. Given the system description and user prompt below, generate a realistic response that this system might produce. Be concise and natural.

System: ${sysDesc}
User prompt: ${prompt}

Generate only the response content, nothing else.`;

  for (let i = 0; i < count; i += 1) {
    try {
      const result = await geminiModel.generateContent(instruction);
      const text = result.response.text().trim();
      responses.push(text);
    } catch (error: any) {
      console.error(`Error generating response ${i + 1}:`, error);
      // Continue with other responses even if one fails
    }
  }

  res.json({ responses });
});

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Predictability Spectrum Toolkit API is running.' });
});

app.listen(port, () => {
  console.log(`PSF Toolkit API listening on http://localhost:${port}`);
});

