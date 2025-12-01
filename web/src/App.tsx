import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { ExpandMore, HelpOutline, Visibility, VisibilityOff } from '@mui/icons-material';
import React, { useMemo, useState } from 'react';

// ---------- Types ----------

type PredictabilityLevel = 1 | 2 | 3 | 4 | 5;
type Stakes = 'low' | 'medium' | 'high';
type Expertise = 'novice' | 'intermediate' | 'expert';

interface Dimensions {
  T: number;
  C: number;
  L: number;
}

interface Modifiers {
  O: number;
  I: number;
  X: number;
  Lp: number;
  F: number;
  S: number;
  A: number;
  D: number;
}

interface Metrics {
  temporalEntropy?: number;
  temporalVariationRate?: number;
  temporalStabilityFromClassifier?: number;
}

interface Rationale {
  overall?: string;
  T?: string;
  C?: string;
  L?: string;
  cues?: string[];
}

interface GuidanceItem {
  id: string;
  title: string;
  summary: string;
  category: 'interface' | 'explanation' | 'trust' | 'transition';
  level: PredictabilityLevel;
}

interface ClassificationResponse {
  level: PredictabilityLevel;
  dimensions: Dimensions;
  overallScore: number;
  modifiers?: Modifiers;
  metrics?: Metrics;
  rationale?: Rationale;
  guidance?: GuidanceItem[];
  notes?: string[];
  version: string;
}

interface SystemProfile {
  domain: string;
  stakes: Stakes;
  expertise: Expertise;
  intendedLevel: PredictabilityLevel;
  expected: Dimensions;
  keyModifiers: Array<'O' | 'I' | 'S' | 'A'>;
}

interface RunRecord {
  id: string;
  profile: SystemProfile;
  probePrompt: string;
  responseTexts?: string[]; // Actual responses from the AI system being tested (for entropy calculation)
  result: ClassificationResponse;
}

interface SelfReport {
  trust: number;
  expectedVariation: number;
  uncertaintyCommunication: number;
  learnability: number;
  checkingFrequency: number;
}

// ---------- Static PSF overview content ----------

type LevelId = 1 | 2 | 3 | 4 | 5;

const LEVELS: { id: LevelId; label: string; summary: string }[] = [
  {
    id: 1,
    label: 'Level 1 · Fully predictable',
    summary:
      'Always gives the same output for the same input. Works like a calculator or search function. Example: A spell checker that always corrects "teh" to "the".'
  },
  {
    id: 2,
    label: 'Level 2 · Mostly predictable',
    summary:
      'Usually consistent, with small variations that users learn quickly. Example: A code autocomplete that suggests similar functions most of the time.'
  },
  {
    id: 3,
    label: 'Level 3 · Predictable with practice',
    summary:
      'Users learn patterns over time, but outputs vary noticeably. Example: A chatbot that gives different but similar answers to the same question.'
  },
  {
    id: 4,
    label: 'Level 4 · Often surprising',
    summary:
      'Useful but frequently unexpected. Users need to check outputs carefully. Example: A creative writing assistant that sometimes changes style or tone unexpectedly.'
  },
  {
    id: 5,
    label: 'Level 5 · Open‑ended and unstable',
    summary:
      'Highly creative or unpredictable. Hard to know what you\'ll get. Example: An open-ended story generator that creates wildly different stories each time.'
  }
];

const DIMENSIONS_INFO = [
  {
    key: 'T',
    label: 'Temporal (T)',
    summary: 'How stable are outputs over time for the same or very similar inputs?'
  },
  {
    key: 'C',
    label: 'Confidence (C)',
    summary: 'How clearly does the system communicate uncertainty and limits?'
  },
  {
    key: 'L',
    label: 'Learning (L)',
    summary: 'How quickly can people form a reliable mental model of the system’s behaviour?'
  }
];

const MODIFIERS_INFO = [
  {
    key: 'O',
    label: 'Observability (O)',
    summary: 'How easy is it to see what the system did and why?',
    uiControllable: true,
    whyNotControllable: null
  },
  {
    key: 'I',
    label: 'Intervention (I)',
    summary: 'How easily can users steer, stop, or correct the system when it drifts?',
    uiControllable: true,
    whyNotControllable: null
  },
  {
    key: 'X',
    label: 'Cross‑context consistency (X)',
    summary: 'Does behaviour stay coherent across tasks, modalities, and sessions?',
    uiControllable: false,
    whyNotControllable: 'This is a system-level property that emerges from how the model behaves across different contexts and modalities. It cannot be directly controlled through UI features.'
  },
  {
    key: 'Lp',
    label: 'Latency predictability (Lp)',
    summary: 'Are response times stable enough that people can build timing expectations?',
    uiControllable: false,
    whyNotControllable: 'This depends on infrastructure, network conditions, and model complexity rather than UI design choices. It is computed automatically based on system properties.'
  },
  {
    key: 'F',
    label: 'Feedback responsiveness (F)',
    summary: 'Does the system meaningfully adapt to explicit corrections and feedback?',
    uiControllable: false,
    whyNotControllable: 'This reflects how well the underlying model incorporates user feedback, which is influenced by expertise level but not directly controlled by specific UI features.'
  },
  {
    key: 'S',
    label: 'Safety posture (S)',
    summary: 'How reliably does the system avoid clearly harmful or out‑of‑scope behaviour?',
    uiControllable: true,
    whyNotControllable: null
  },
  {
    key: 'A',
    label: 'Social alignment (A)',
    summary: 'Does behaviour respect relevant social norms, roles, and power dynamics?',
    uiControllable: true,
    whyNotControllable: null
  },
  {
    key: 'D',
    label: 'External context drift (D)',
    summary: 'How sensitive is the system to changes in the external world or underlying model?',
    uiControllable: false,
    whyNotControllable: 'This captures environmental and pipeline volatility that affects the system over time. It is not a UI feature but a system-level characteristic that is monitored rather than controlled.'
  }
];

// ---------- Helpers ----------

function valueToPercent(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 100)));
}

function computeTemporalMetricsFromSamples(samples: string[]): {
  temporalEntropy: number;
  temporalVariationRate: number;
} {
  if (!samples || samples.length === 0) {
    return { temporalEntropy: 0, temporalVariationRate: 0 };
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

  // If no valid samples, return zeros
  if (validCount === 0) {
    return { temporalEntropy: 0, temporalVariationRate: 0 };
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

// ---------- Components ----------

function PSFOverview() {
  return (
    <Stack spacing={5}>
      {/* Hero */}
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: 1, fontWeight: 700 }}>
          Predictability Spectrum Framework
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, mt: 1, mb: 1 }}>
          Designing with model predictability in mind
        </Typography>
        <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
          This site distills the Predictability Spectrum Framework (PSF) from the paper into a compact
          guide. It focuses on how AI systems feel to users - how stable, learnable, and communicative
          they are - and how designers can deliberately shape those properties.
        </Typography>
      </Box>

      {/* Levels overview */}
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            The five PSF levels
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Levels capture the overall felt predictability of an AI surface, from fully dependable tools
            to highly open‑ended, surprising systems.
          </Typography>
          <Stack spacing={2}>
            {LEVELS.map(level => (
              <Box key={level.id}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {level.label}
                </Typography>
                <Typography variant="body2">
                  {level.summary}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Three core dimensions: T / C / L
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Instead of a single predictability score, PSF separates temporal stability, uncertainty
            communication, and human learning.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {DIMENSIONS_INFO.map(dim => (
              <Box key={dim.key} sx={{ flex: 1 }}>
                <Chip
                  label={dim.label}
                  size="small"
                  sx={{
                    mb: 1,
                    fontWeight: 600
                  }}
                />
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {dim.summary}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Modifier traits */}
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Modifier traits
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, maxWidth: 720 }}>
            Modifiers capture design‑sensitive properties that can shift how predictable a given level
            feels in practice.
          </Typography>
          <Stack spacing={2} direction={{ xs: 'column', md: 'row' }} flexWrap="wrap" useFlexGap>
            {MODIFIERS_INFO.map(mod => (
              <Box key={mod.key} sx={{ flex: { xs: '1 1 auto', md: '1 1 45%' } }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {mod.key} · {mod.label}
                  </Typography>
                  {!mod.uiControllable && (
                    <Tooltip title={mod.whyNotControllable || ''}>
                      <HelpOutline fontSize="small" color="action" />
                    </Tooltip>
                  )}
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {mod.summary}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ---------- Design Lab Documentation ----------

function DesignLabDocs() {
  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Design Lab Documentation
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            This comprehensive guide explains how to use the PSF Design Lab to assess AI systems, explore design guidance, and compare configurations. Each feature includes detailed explanations of its purpose, logic, and practical examples.
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 3 }}>
            Overview: Why the Design Lab?
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The Design Lab operationalizes the Predictability Spectrum Framework by providing a structured workflow for evaluating AI systems. Rather than treating predictability as binary, the lab helps you understand where your system falls on a spectrum from fully predictable (Level 1) to open-ended (Level 5), and provides actionable guidance for design improvements.
          </Typography>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 3 }}>
            Two Primary Use Cases
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>1. Assessment & Evaluation (Understanding Existing Systems)</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Use the lab to evaluate existing AI systems and understand their predictability characteristics. Create a system profile describing the current system, run probes to test its behavior, and receive a PSF classification. This helps you:
            <br />• Understand where an existing system falls on the predictability spectrum
            <br />• Identify predictability gaps or issues
            <br />• Compare different versions or configurations of the same system
            <br />• Generate evidence-based reports about system behavior
            <br /><br />
            <strong>Example:</strong> You have a deployed chatbot. Create a profile describing its current features, run probes testing its repeatability and uncertainty communication, and receive guidance on how to improve its predictability.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>2. Design & Planning (Building New Systems)</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Use the lab to plan and design new AI systems by exploring different design choices and their predictability implications. Create hypothetical system profiles describing your design intent, explore guidance for your target PSF level, and compare different design configurations. This helps you:
            <br />• Determine target PSF level based on domain requirements
            <br />• Explore which UI features (modifiers) will achieve desired predictability
            <br />• Compare design alternatives before implementation
            <br />• Generate design specifications based on PSF guidance
            <br /><br />
            <strong>Example:</strong> You're designing a medical triage assistant. Create a profile with high stakes and expert users, set intended level to 1-2, enable safety modifiers (S), and receive guidance on interface patterns, explanation strategies, and trust mechanisms needed to achieve that level.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Key Point:</strong> Yes, you need a system profile in both cases. For existing systems, describe what currently exists. For new systems, describe your design intent and target characteristics. The profile provides context that shapes both the assessment and the guidance you receive.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Assess Tab: Core Assessment Workflow
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            The Assess tab follows a three-step process that mirrors how designers and researchers evaluate AI systems in practice. Each step builds context for the next, ensuring assessments are grounded in realistic scenarios.
          </Typography>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, mt: 2 }}>
            Step 1: System Profile
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Establish the context and constraints that shape predictability expectations. Different domains, user expertise levels, and risk profiles require different predictability thresholds.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> The PSF recognizes that predictability is context-dependent. A medical triage bot needs higher predictability than a creative writing assistant. The system profile captures these contextual factors so the classifier can provide domain-appropriate assessments.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Fields Explained:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>Domain / task:</strong> Describes what the system does and its primary use case. Critical for contextualizing predictability expectations.<br />
            • <strong>Stakes of mistakes:</strong> Low/Medium/High. High-stakes systems (medical, financial) require stricter predictability than low-stakes ones (entertainment, casual chat).<br />
            • <strong>Typical user expertise:</strong> Novice/Intermediate/Expert. Used for modifier calculations and design guidance only—<strong>not</strong> sent to Gemini for classification to ensure unbiased assessment. Novice users benefit from higher observability and feedback responsiveness in modifier calculations; experts can handle more variation. Design guidance adapts based on expertise (e.g., "Gate advanced behaviors behind expertise-sensitive controls" for expert users).<br />
            • <strong>UI Features:</strong> Select UI features your system has or plans to implement (O, I, S, A). These directly influence modifier scores and design guidance:
            <br />&nbsp;&nbsp;- <strong>O (Observability):</strong> Confidence badges, rationale views that show what the system did and why<br />
            <br />&nbsp;&nbsp;- <strong>I (Intervention):</strong> Interrupt/abort buttons that let users stop or correct the system<br />
            <br />&nbsp;&nbsp;- <strong>S (Safety posture):</strong> Safe mode / conservative mode that reduces risk<br />
            <br />&nbsp;&nbsp;- <strong>A (Social alignment):</strong> Rationale views showing reasoning traces that respect social norms<br />
            <br />These features are <strong>sent to the backend</strong> and used to compute modifier scores, which affect design guidance. Only O, I, S, and A are directly controllable through UI features. Other modifiers (X, Lp, F, D) are system-level properties computed automatically.<br />
            • <strong>Advanced assumptions:</strong> Optional fields for comparison only (not sent to Gemini):
            <br />&nbsp;&nbsp;- <strong>Assumed level:</strong> Your assumed PSF level (1-5). Used only for comparison: &quot;I assumed Level 2, but got Level 3—why?&quot; Compare your assumption to the actual level in Step 3 results.
            <br />&nbsp;&nbsp;- <strong>Assumption dimensions:</strong> Your assumed T/C/L scores (0-1). Used to compare your assumptions against Gemini&apos;s independent assessment. Helps identify gaps: &quot;I assumed T=0.75, but got T=0.60—what&apos;s causing lower temporal predictability?&quot;
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Important:</strong> Gemini (the classifier running in the backend) evaluates your description and responses to provide an <strong>independent, raw assessment</strong>. It evaluates based only on your system description (domain, stakes, UI features) and probe results—it does <strong>not</strong> see your assumption scores, assumed level, or user expertise. User expertise is excluded from classification to prevent bias and ensure the assessment reflects the system's actual predictability, not assumptions about users. Expertise is still used for modifier calculations and design guidance (deterministic, server-side adjustments). After receiving results, you can compare them to your assumptions in Step 3 to identify gaps and validate your expectations.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> For a medical diagnosis assistant, you might set: Domain: "Clinical decision support for primary care", Stakes: "High", Expertise: "Expert", UI Features: O (confidence badges), S (safe mode), Assumed level: 2, Assumption T/C/L: 0.85/0.80/0.75. The AI will classify based on your domain, stakes, and UI features only (expertise is excluded for unbiased assessment). Modifier calculations and design guidance will still use expertise appropriately. You can compare the assessment to your assumptions. If you assumed Level 2 but got Level 3, you can analyze why there&apos;s a gap.
          </Typography>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, mt: 2 }}>
            Step 2: Probing Interactions
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Test how the system behaves in practice. Probes simulate real interactions to reveal predictability characteristics that static descriptions miss.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> Predictability is revealed through behavior, not just specifications. Probes test the core T/C/L dimensions by examining how the system responds to actual inputs. You can test repeatability (T) by running the same prompt multiple times, uncertainty communication (C) by asking questions that might be uncertain, and learnability (L) by testing sequences of related tasks.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Important:</strong> The probe prompt should be the <strong>actual input/task</strong> you want to test, not a description of how to test. For example, if testing a code completion tool, enter the actual code you want completed (e.g., &quot;def process_data(data: List[Dict]) -&gt; Dict:&quot;), not &quot;test the system&apos;s repeatability.&quot;
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Probe Examples:</strong> Write your own actual input/task in the text field. For example:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>For code completion tools:</strong> &quot;def process_data(data: List[Dict]) -&gt; Dict:&quot; or &quot;class UserManager:&quot;<br />
            • <strong>For chatbots:</strong> &quot;Explain how neural networks work&quot; or &quot;Write a haiku about coding&quot;<br />
            • <strong>For testing repeatability (T):</strong> Run the same prompt multiple times and compare responses<br />
            • <strong>For testing uncertainty (C):</strong> Ask questions that might be outside the system&apos;s expertise<br />
            • <strong>For testing learnability (L):</strong> Use sequences of related tasks to see if patterns emerge
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Auto-generate Responses (P<sub>t</sub> Approximation):</strong> Enable the checkbox to automatically generate multiple responses for entropy calculation and improved classification. You can configure the number of samples (default: 20, range: 5-50). The system will:
            <br />• Generate the specified number of responses based on your probe prompt and system description
            <br />• Classify up to 10 of them independently and average the T/C/L scores for more robust assessment
            <br />• Use all generated responses to calculate temporal entropy and variation rate (P<sub>t</sub> approximation)
            <br />• Automatically display temporal metrics in Step 3 results
            <br />Higher entropy indicates more variation. More samples provide better P<sub>t</sub> approximation but take longer.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Interactive Probe (Q<sub>t</sub><sup>u</sup> Capture):</strong> Optionally record your expectations before running the probe to improve C and L accuracy:
            <br />• <strong>Expected output:</strong> Describe what you expect the system to produce. This helps construct your mental model (Q<sub>t</sub><sup>u</sup>) for Learning predictability calculation.
            <br />• <strong>Expected variation:</strong> Use the slider (0 = identical, 1 = completely different) to indicate how much variation you expect across repeated uses. This helps refine Confidence predictability.
            <br />When provided, the toolkit uses exact formulas from the paper (Section 2.2) to compute C and L, blending them with Gemini's estimates for robustness.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> For a code completion tool, enter the probe prompt: &quot;def process_data(data: List[Dict]) -&gt; Dict:&quot;. Enable auto-generate with 20 samples. Optionally fill in: Expected output: &quot;I expect it to complete with error handling and type hints&quot;, Expected variation: 0.2 (low variation). The lab will generate 20 responses, classify 10 of them and average results, compute entropy from all 20, and use your expectations to refine C and L using exact formulas.
          </Typography>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, mt: 2 }}>
            Step 3: PSF Assessment Results
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Receive a structured classification that positions your system on the predictability spectrum and explains why.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> The classifier (powered by Gemini) analyzes your system description and probe results to assign a PSF level (1-5) and T/C/L scores (0-1). It also computes modifier scores and provides rationale explaining the classification.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary', borderLeft: '3px solid', borderColor: 'primary.main', bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            <strong>How the Toolkit Computes T/C/L (Hybrid Approach):</strong> The toolkit uses a hybrid approach combining exact formulas and proxy methods:
            <br />• <strong>T (Temporal):</strong> Uses exact Shannon entropy formula from the paper (Section 2.2) when response samples are available. Computes H = -Σ p log₂(p) and normalizes to T = 1 - H/H_max. When auto-generate is enabled, classifies multiple responses and averages T scores for robustness.
            <br />• <strong>C (Confidence):</strong> Uses exact formula (C = Σ P_t(x) Q_t^u(x) / Σ P_t(x)) when response samples and user expectations are provided. Otherwise uses Gemini as a proxy classifier. Blends 50% exact + 50% Gemini estimate when both are available.
            <br />• <strong>L (Learning):</strong> Uses exact KL divergence formula (L = exp(-λ · D_KL(P_t || Q_t^u))) when response samples and expected output are provided. Otherwise uses Gemini as a proxy classifier. Blends 50% exact + 50% Gemini estimate when both are available.
            <br />This hybrid approach provides mathematical rigor when data is available, while gracefully falling back to proxy methods (as recommended in paper Section 2.4) when direct measurement is infeasible.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>What You'll See:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>Assumed vs Actual Comparison:</strong> If you set assumed level or assumption T/C/L in Step 1, you&apos;ll see a comparison box showing your assumptions vs the independent assessment. This helps identify gaps and validate expectations.<br />
            • <strong>PSF Level:</strong> Overall predictability level from 1 (fully predictable) to 5 (open-ended), averaged across multiple classifications when auto-generate is used<br />
            • <strong>T/C/L Dimensions:</strong> Scores for Temporal, Confidence, and Learning predictability (averaged when multiple responses are classified)<br />
            • <strong>AI System Outputs:</strong> Toggle button to show/hide the actual responses generated by the system (hidden by default to keep view clean)<br />
            • <strong>Temporal Metrics (P<sub>t</sub> Approximation):</strong> Automatically computed entropy and variation rate when auto-generate is enabled. Shows computed values and indicates when exact formulas were used<br />
            • <strong>Modifiers:</strong> Eight modifier traits (O, I, X, Lp, F, S, A, D) that influence how predictability feels in practice<br />
            • <strong>Rationale:</strong> Explanation of why the system received its classification, including textual cues the classifier identified<br />
            • <strong>Notes:</strong> Technical details about computation method (e.g., "Averaged classification across 10 response samples", "C computed using exact formula")
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> A code completion tool might receive: Level 2 (Mostly predictable), T: 0.75, C: 0.65, L: 0.70. If you assumed Level 2 and T/C/L of 0.80/0.70/0.75, the comparison will show: Assumed Level 2 vs Actual Level 2 (match!), Assumed T: 0.80 vs Actual T: 0.75 (gap: -0.05), etc. Rationale: &quot;The system shows consistent behavior on common patterns (high T) but occasionally suggests unexpected completions (moderate C). Users learn its patterns quickly (high L).&quot;
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Design Tab: Actionable Guidance
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Translate PSF assessments into concrete design recommendations. Guidance is tailored to your system's level, dimensions, modifiers, stakes, and user expertise.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> Different PSF levels require different design strategies. Level 1-2 systems benefit from simplicity and speed. Level 3 systems need scaffolding and progressive disclosure. Level 4-5 systems require guardrails and human-in-the-loop controls. The guidance generator considers all these factors based on the actual assessed level.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Guidance Categories:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>Interface:</strong> UI patterns and controls (e.g., "Add mode switches for expert users" for Level 3)<br />
            • <strong>Explanation:</strong> How to communicate system behavior (e.g., "Show reasoning traces" for Level 4)<br />
            • <strong>Trust:</strong> Building appropriate user expectations (e.g., "Present as advisory only" for Level 5)<br />
            • <strong>Transition:</strong> Helping users adapt to unpredictability (e.g., "Provide recovery options" for Level 4)
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> A Level 3 medical assistant might receive guidance: "Gate advanced behaviors behind expertise-sensitive controls" (Interface), "Explain when the system is uncertain" (Explanation), "Use checklists for high-stakes decisions" (Trust).
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Reflect Tab: Session History and Analysis
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Track your assessment journey, identify patterns, and export data for further analysis or reporting.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> Design decisions evolve over time. The Reflect tab helps you see how different configurations affect predictability, track improvements, and maintain a record of your design process.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Features:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>Quick Self-Report (PSF-aligned):</strong> Rate your perception of the system using sliders aligned with PSF dimensions (trust, expected variation, uncertainty communication, learnability, checking frequency). This captures your mental model (Q<sub>t</sub><sup>u</sup>) for comparison with model assessments.<br />
            • <strong>Session Snapshot:</strong> Visual summary showing number of probes run, average T/C/L scores across all runs<br />
            • <strong>Assessment History:</strong> List of all probes run with their results, organized chronologically
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> After running 5 probes on different configurations of a chatbot, you might see: Average T: 0.68, C: 0.72, L: 0.65. Compare your self-reported expectations (e.g., "I expected low variation") with the actual T/C/L scores to identify gaps in your mental model.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Compare Tab: Side-by-Side Analysis
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> Understand how design choices affect predictability by comparing multiple configurations or probe results.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> Predictability is relative. Comparing configurations helps identify which design decisions improve or degrade predictability. This is especially useful for A/B testing or exploring design alternatives.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Use Cases:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • Compare baseline vs. variant configurations (e.g., with/without confidence badges)<br />
            • Compare different probe types on the same system<br />
            • Compare the same system across different domains or user expertise levels<br />
            • Identify which modifiers have the strongest impact on predictability
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> Compare a code completion tool with confidence badges (O modifier) vs. without. You might find that confidence badges increase Confidence (C) predictability from 0.60 to 0.75, demonstrating the value of observability features.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            UI Features Section: Active Design Parameters
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> The "UI Features" section in Step 1 lets you specify which UI features your system has or plans to implement. These directly affect modifier scores (O, I, S, A) and influence design guidance. This is separate from "Advanced assumptions" which are comparison-only.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> Not all modifiers are equally actionable. Observability (O), Controllability (I), Safety Posture (S), and Social Alignment (A) map to specific UI patterns that designers can implement. These are "active" inputs—they are sent to the backend and used to compute modifier scores. Other modifiers (X, Lp, F, D) are system-level properties computed automatically.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>The Four UI-Controllable Modifiers:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>O (Observability):</strong> Controlled via confidence badges, uncertainty indicators, or rationale views. Increases user ability to see what the system is doing. Selecting this increases the O modifier score.<br />
            • <strong>I (Controllability):</strong> Controlled via interrupt/abort buttons, undo controls, or steering mechanisms. Gives users corrective leverage. Selecting this increases the I modifier score.<br />
            • <strong>S (Safety Posture):</strong> Controlled via safe mode, conservative settings, or guardrails. Signals stronger risk management. Selecting this increases the S modifier score.<br />
            • <strong>A (Social Alignment):</strong> Controlled via rationale views that show reasoning traces. Helps systems respect conversational norms. Selecting this increases the A modifier score.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> For a medical assistant, selecting O (confidence badges) and S (safe mode) increases Observability and Safety Posture modifier scores. This affects design guidance—if O is low, guidance will suggest increasing observability. These selections are sent to the backend and actively influence classification and guidance.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            User Expertise: How It's Used
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> The "Typical user expertise" field (Novice/Intermediate/Expert) is used for modifier calculations and design guidance, but <strong>excluded from Gemini classification</strong> to ensure unbiased, raw assessment of system predictability.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>How Expertise Is Used:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>Modifier Calculations:</strong> Expertise affects Observability (O) and Feedback responsiveness (F) modifiers. Novice users get +0.1 to O and F (they benefit from higher observability and feedback). Expert users get -0.05 to O (they can tolerate lower observability if other cues exist). These are deterministic, server-side adjustments.<br />
            • <strong>Design Guidance:</strong> Expertise influences guidance generation. For example, if expertise is "novice" and level ≥ 3, guidance suggests "Provide novice-friendly pathways into higher levels." If expertise is "expert", guidance may suggest "Gate advanced behaviors behind expertise-sensitive controls."<br />
            • <strong>NOT Used for Classification:</strong> Expertise is <strong>excluded</strong> from the system description sent to Gemini. This ensures the classification reflects the system's actual predictability, not assumptions about users. The goal is to test the system "raw" and get an unbiased assessment.<br />
            • <strong>NOT Used for Mental Model Mapping (Q_t^u):</strong> The mental model (Q_t^u) is constructed from the Interactive Probe section (expected output and expected variation), not from expertise. Expertise does not influence C or L calculations via Q_t^u.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Rationale:</strong> We want Gemini to assess predictability based on system behavior (domain, stakes, UI features, responses), not user assumptions. Expertise is still valuable for modifier adjustments and guidance, but keeping it separate from classification ensures the assessment is objective and reflects the system's true predictability characteristics.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Advanced Assumptions: Comparison-Only Fields
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Purpose:</strong> The "Advanced assumptions" accordion in Step 1 contains optional fields for comparison only. These are <strong>not sent to Gemini</strong>—they are kept separate to ensure unbiased assessment. After receiving results, you can compare your assumptions to the actual assessment.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Logic:</strong> There is a critical distinction between UI Features (active inputs) and Advanced Assumptions (comparison-only):
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>UI Features (O, I, S, A):</strong> These represent actual UI features your system has or plans to implement. They are <strong>sent to the backend</strong> and used to compute modifier scores. They actively affect classification and design guidance.<br />
            • <strong>Advanced Assumptions (Assumed level, Assumption T/C/L):</strong> These are your expectations or hypotheses about what the PSF level and T/C/L scores should be. They are <strong>not sent to Gemini</strong>—kept separate for unbiased assessment. Used only for comparison in Step 3 results.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Why This Distinction Matters:</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, pl: 2 }}>
            • <strong>UI Features</strong> are factual inputs about your system design—they describe what exists or will exist. The backend uses them to compute modifier scores and tailor guidance.<br />
            • <strong>Advanced Assumptions</strong> are your predictions or expectations—they describe what you think the assessment will show. Keeping them separate ensures Gemini provides an independent, unbiased assessment. You can then compare your assumptions to reality.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2, fontStyle: 'italic', color: 'text.secondary' }}>
            <strong>Example:</strong> You might set UI Features: O (confidence badges), S (safe mode). These are sent to the backend. Separately, you might set Advanced Assumptions: Assumed level: 2, Assumption T/C/L: 0.85/0.80/0.75. These are NOT sent to Gemini. After running a probe, you might find the actual level is 3 and T/C/L is 0.70/0.65/0.68. The comparison view shows: "Assumed Level 2 vs Actual Level 3 (gap: 1)" and highlights differences in T/C/L, helping you identify why your assumptions differed from reality.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Best Practices and Tips
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>1. Be Specific in System Descriptions</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Include domain, use case, and user context. Vague descriptions lead to generic assessments. Example: Instead of "AI assistant", use "Code completion tool for professional software developers working in Python."
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>2. Use Representative Probes</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Probes should reflect real-world interactions. Test scenarios users actually encounter. Example: For a translation tool, probe with "Translate a technical document with domain-specific terminology" rather than "Translate hello."
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>3. Use Auto-generate for Better Assessment</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Enable auto-generate to get more robust assessments. The toolkit will generate multiple responses (default: 20, configurable 5-50), classify a subset and average results, and automatically compute temporal metrics. This provides:
            <br />• More robust T/C/L scores through averaging
            <br />• Automatic entropy calculation (no need to run multiple probes)
            <br />• Better P<sub>t</sub> approximation for exact C/L formulas
            <br />Example: For a code generator, enable auto-generate with 20 samples to get averaged classification and precise temporal metrics in one run.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>4. Use Interactive Probes for Exact Formulas</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Fill in the Interactive Probe section (expected output and variation) to enable exact C and L formulas from the paper. When you provide your expectations (Q<sub>t</sub><sup>u</sup>), the toolkit computes Confidence and Learning predictability using the exact mathematical formulas (Section 2.2), blending them with Gemini estimates for robustness. This significantly improves mathematical accuracy compared to proxy-only methods.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>5. Compare Configurations Systematically</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            Use Compare to test design hypotheses. Change one modifier at a time to isolate effects. Example: Run probes with and without confidence badges to measure the impact of Observability on Confidence predictability.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>6. Review Rationale Explanations</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            The classifier provides explanations for its assessments. These reveal which textual cues influenced the classification. Use this to refine your system descriptions and understand the framework's reasoning.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>7. Using the Lab for Design vs Assessment</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
            <strong>For Assessment:</strong> Describe the system as it currently exists. Run probes with actual system outputs when possible. Use results to identify gaps and prioritize improvements.<br />
            <strong>For Design:</strong> Describe your target system and intended characteristics. Set the intended PSF level based on domain requirements. Use guidance to generate design specifications. Compare different modifier configurations to see which UI features achieve your target predictability level. You don't need working probes—use hypothetical scenarios or skip probes and focus on the Design tab guidance.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}

// ---------- Interactive PSF Design Lab ----------

function PSFVisualization({
  result,
  expected,
  intendedLevel,
  history,
  currentProbePrompt,
  onCalculateEntropy,
  responseTexts
}: {
  result: ClassificationResponse;
  expected?: Dimensions;
  intendedLevel?: PredictabilityLevel;
  history?: RunRecord[];
  currentProbePrompt?: string;
  onCalculateEntropy?: (metrics: { temporalEntropy: number; temporalVariationRate: number }) => void;
  responseTexts?: string[];
}) {
  const [showOutputs, setShowOutputs] = useState(false);
  const hasAssumptions = expected !== undefined || intendedLevel !== undefined;
  
  // Check if we have enough responses for entropy calculation
  // Either: same probe run 3+ times with responses, OR one run with 3+ auto-generated responses
  const sameProbeRuns = history?.filter(
    r => r.probePrompt === currentProbePrompt && r.responseTexts && r.responseTexts.length > 0
  ) || [];
  
  // Collect all responses from all runs
  const allResponses = sameProbeRuns.flatMap(r => r.responseTexts || []);
  const canCalculateEntropy = allResponses.length >= 3;
  
  const handleCalculateEntropy = () => {
    if (!canCalculateEntropy || !onCalculateEntropy) return;
    const metrics = computeTemporalMetricsFromSamples(allResponses);
    onCalculateEntropy(metrics);
  };

  return (
    <Stack spacing={1}>
      {hasAssumptions && (
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Assumed vs Actual Comparison
          </Typography>
          {intendedLevel !== undefined && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2">
                Assumed Level: <strong>{intendedLevel}</strong>
              </Typography>
              <Typography variant="body2">
                Actual Level: <strong>{result.level}</strong>
              </Typography>
              {intendedLevel !== result.level && (
                <Chip
                  label={`Gap: ${Math.abs(intendedLevel - result.level)}`}
                  size="small"
                  color={intendedLevel < result.level ? 'warning' : 'success'}
                />
              )}
            </Stack>
          )}
          {expected && (
            <Stack spacing={0.5}>
              {(['T', 'C', 'L'] as const).map(key => {
                const expectedVal = expected[key];
                const actualVal = result.dimensions[key];
                const diff = actualVal - expectedVal;
                return (
                  <Box key={key}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        {key === 'T' && 'Temporal (T)'}
                        {key === 'C' && 'Confidence (C)'}
                        {key === 'L' && 'Learning (L)'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Assumed: {expectedVal.toFixed(2)}
                        </Typography>
                        <Typography variant="caption">Actual: {actualVal.toFixed(2)}</Typography>
                        {Math.abs(diff) > 0.1 && (
                          <Chip
                            label={diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                            size="small"
                            color={diff > 0 ? 'success' : 'error'}
                            sx={{ height: 20 }}
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip label={`Level ${result.level}`} size="small" sx={{ fontWeight: 600 }} />
        <Typography variant="body2">Overall: {result.overallScore.toFixed(2)}</Typography>
      </Stack>
      <Typography variant="caption">Core dimensions</Typography>
      {(['T', 'C', 'L'] as const).map(key => (
        <Box key={key}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">
              {key === 'T' && 'Temporal (T)'}
              {key === 'C' && 'Confidence (C)'}
              {key === 'L' && 'Learning (L)'}
            </Typography>
            <Typography variant="caption">{result.dimensions[key].toFixed(2)}</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={valueToPercent(result.dimensions[key])}
            sx={{ height: 6, borderRadius: 999, mb: 0.5 }}
          />
        </Box>
      ))}
      {responseTexts && responseTexts.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              AI System Output{responseTexts.length > 1 ? 's' : ''}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowOutputs(!showOutputs)}
              sx={{ p: 0.5 }}
              title={showOutputs ? 'Hide outputs' : 'Show outputs'}
            >
              {showOutputs ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
            <Typography variant="caption" color="text.secondary">
              ({responseTexts.length} response{responseTexts.length > 1 ? 's' : ''})
            </Typography>
          </Stack>
          {showOutputs && (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              {responseTexts.length === 1 ? (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    bgcolor: 'background.paper',
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  {responseTexts[0]}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Showing {responseTexts.length} generated responses (used for entropy calculation):
                  </Typography>
                  {responseTexts.slice(0, 5).map((response, idx) => (
                    <Box key={idx} sx={{ position: 'relative' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                        Response {idx + 1}:
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          fontFamily: 'monospace',
                          bgcolor: 'background.paper',
                          p: 1,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          fontSize: '0.875rem',
                          maxHeight: 150,
                          overflow: 'auto'
                        }}
                      >
                        {response}
                      </Typography>
                    </Box>
                  ))}
                  {responseTexts.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {responseTexts.length - 5} more response(s) (all used for entropy calculation)
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>
          )}
        </Box>
      )}
      {result.metrics && (result.metrics.temporalEntropy !== undefined ||
        result.metrics.temporalVariationRate !== undefined) && (
        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
            Temporal Metrics (P<sub>t</sub> Approximation)
          </Typography>
          <Typography variant="body2" display="block">
            <strong>Entropy:</strong> {result.metrics.temporalEntropy?.toFixed(3) ?? '–'} 
            {' · '}
            <strong>Variation Rate:</strong> {result.metrics.temporalVariationRate?.toFixed(3) ?? '–'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Computed from {result.metrics.temporalEntropy !== undefined ? 'response samples' : 'available data'}. 
            Lower entropy = more predictable outputs.
          </Typography>
        </Box>
      )}
      {history && currentProbePrompt && !result.metrics?.temporalEntropy && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            <strong>Tip:</strong> Enable "Auto-generate responses" to automatically calculate temporal entropy and variation rate from multiple response samples.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={!canCalculateEntropy}
            onClick={handleCalculateEntropy}
            sx={{ mb: 1 }}
          >
            Calculate entropy/variation (manual)
          </Button>
          {!canCalculateEntropy && allResponses.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Need {3 - allResponses.length} more response(s) to calculate entropy/variation. Run the probe again with auto-generate enabled.
            </Typography>
          )}
          {!canCalculateEntropy && allResponses.length === 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              Need 3+ responses to calculate entropy/variation. Enable auto-generate (generates 20 responses by default) and run the probe.
            </Typography>
          )}
        </Box>
      )}
      {result.rationale && (
        <Box sx={{ mt: 1 }}>
          {result.rationale.overall && (
            <Typography variant="caption" display="block">
              {result.rationale.overall}
            </Typography>
          )}
          {(result.rationale.T || result.rationale.C || result.rationale.L) && (
            <Typography variant="caption" display="block">
              {result.rationale.T && `T: ${result.rationale.T} `}
              {result.rationale.C && `C: ${result.rationale.C} `}
              {result.rationale.L && `L: ${result.rationale.L}`}
            </Typography>
          )}
          {result.rationale.cues && result.rationale.cues.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
              {result.rationale.cues.map(cue => (
                <Chip key={cue} label={cue} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
        </Box>
      )}
      {result.notes && result.notes.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {result.notes.map((note, idx) => (
            <Typography key={idx} variant="caption" display="block" sx={{ mb: 0.5 }}>
              {note}
            </Typography>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function AssessTab({
  onRun,
  lastResult,
  loading,
  error,
  history,
  profile,
  setProfile,
  probePrompt,
  setProbePrompt,
  autoGenerate,
  setAutoGenerate,
  sampleCount,
  setSampleCount,
  expectedOutput,
  setExpectedOutput,
  expectedVariation,
  setExpectedVariation,
  calculatedMetrics,
  setCalculatedMetrics
}: {
  onRun: (
    profile: SystemProfile, 
    prompt: string, 
    responseTexts?: string[],
    userExpectations?: { expectedOutput?: string; expectedVariation?: number; expectedConfidence?: number },
    sampleCount?: number
  ) => Promise<void>;
  lastResult: ClassificationResponse | null;
  loading: boolean;
  error: string | null;
  history?: RunRecord[];
  profile: SystemProfile;
  setProfile: React.Dispatch<React.SetStateAction<SystemProfile>>;
  probePrompt: string;
  setProbePrompt: React.Dispatch<React.SetStateAction<string>>;
  autoGenerate: boolean;
  setAutoGenerate: React.Dispatch<React.SetStateAction<boolean>>;
  sampleCount: number;
  setSampleCount: React.Dispatch<React.SetStateAction<number>>;
  expectedOutput: string;
  setExpectedOutput: React.Dispatch<React.SetStateAction<string>>;
  expectedVariation: number | null;
  setExpectedVariation: React.Dispatch<React.SetStateAction<number | null>>;
  calculatedMetrics: {
    temporalEntropy?: number;
    temporalVariationRate?: number;
  } | null;
  setCalculatedMetrics: React.Dispatch<React.SetStateAction<{
    temporalEntropy?: number;
    temporalVariationRate?: number;
  } | null>>;
}) {
  const handleAnalyze = async () => {
    const prompt = probePrompt;
    
    let responseTexts: string[] | undefined;
    
    if (autoGenerate) {
      // Auto-generate responses (configurable count for better P_t approximation)
      try {
        // System description for response generation (exclude expertise for raw assessment)
        const systemDescription = [
          profile.domain && `Domain: ${profile.domain}`,
          `Stakes: ${profile.stakes}`
        ]
          .filter(Boolean)
          .join(' | ');
        
        const res = await fetch('http://localhost:4000/api/generate-responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            systemDescription,
            count: sampleCount // Use configurable sample count
          })
        });
        
        if (res.ok) {
          const data = await res.json() as { responses: string[] };
          responseTexts = data.responses;
        }
      } catch (error) {
        console.error('Error generating responses:', error);
      }
    }
    
    // Prepare user expectations (Q_t^u data) for interactive probe
    const userExpectations = {
      expectedOutput: expectedOutput || undefined,
      expectedVariation: expectedVariation !== null ? expectedVariation : undefined,
      expectedConfidence: undefined // Can be added later
    };
    
    await onRun(profile, prompt, responseTexts, userExpectations, sampleCount);
    // Reset calculated metrics when running a new probe
    setCalculatedMetrics(null);
  };

  const handleCalculateEntropy = (metrics: { temporalEntropy: number; temporalVariationRate: number }) => {
    setCalculatedMetrics(metrics);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" color="text.secondary">
        Step 1 · System profile
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>System profile</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe the AI surface you are evaluating: what it does, who it is for, and how risky mistakes are. Select UI features your system has or plans to implement. Optionally set your assumptions for comparison later.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Domain / task"
              placeholder="e.g., IDE assistant, medical triage bot, tutoring agent..."
              value={profile.domain}
              onChange={e => setProfile({ ...profile, domain: e.target.value })}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Stakes of mistakes"
                value={profile.stakes}
                onChange={e => setProfile({ ...profile, stakes: e.target.value as Stakes })}
                fullWidth
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </TextField>
              <TextField
                select
                label="Typical user expertise"
                value={profile.expertise}
                onChange={e =>
                  setProfile({ ...profile, expertise: e.target.value as Expertise })
                }
                fullWidth
              >
                <MenuItem value="novice">Novice</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="expert">Expert</MenuItem>
              </TextField>
            </Stack>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">UI Features</Typography>
                <Tooltip title="Select UI features that your system has or plans to implement. These directly affect modifier scores (O, I, S, A) and influence design guidance. Only O, I, S, and A are directly controllable through UI features. Other modifiers (X, Lp, F, D) are system-level properties computed automatically.">
                  <HelpOutline fontSize="small" />
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(['O', 'I', 'S', 'A'] as const).map(m => {
                  const modInfo = MODIFIERS_INFO.find(info => info.key === m);
                  const displayLabel = modInfo?.label || m;
                  return (
                    <Tooltip
                      key={m}
                      title={modInfo?.summary || ''}
                    >
                      <Chip
                        label={displayLabel}
                        color={profile.keyModifiers.includes(m) ? 'primary' : 'default'}
                        variant={profile.keyModifiers.includes(m) ? 'filled' : 'outlined'}
                        size="small"
                        onClick={() => {
                          const present = profile.keyModifiers.includes(m);
                          setProfile({
                            ...profile,
                            keyModifiers: present
                              ? profile.keyModifiers.filter(x => x !== m)
                              : [...profile.keyModifiers, m]
                          });
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>
            <Accordion variant="outlined">
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2">Advanced assumptions</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Assumed level
                  </Typography>
                  <Slider
                    value={profile.intendedLevel}
                    min={1}
                    max={5}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    onChange={(_, v) =>
                      setProfile({ ...profile, intendedLevel: v as PredictabilityLevel })
                    }
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Assumption dimensions
                  </Typography>
                  {(['T', 'C', 'L'] as const).map(key => (
                    <Box key={key} sx={{ mt: 1 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                          {key === 'T' && 'Temporal (T)'}
                          {key === 'C' && 'Confidence (C)'}
                          {key === 'L' && 'Learning (L)'}
                        </Typography>
                        <Typography variant="caption">
                          {profile.expected[key].toFixed(2)}
                        </Typography>
                      </Stack>
                      <Slider
                        size="small"
                        value={profile.expected[key]}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(_, v) =>
                          setProfile({
                            ...profile,
                            expected: { ...profile.expected, [key]: v as number }
                          })
                        }
                      />
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Stack>
          </CardContent>
        </Card>

      <Typography variant="subtitle2" color="text.secondary">
        Step 2 · Probing interactions
      </Typography>
      <Card>
        <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Probing interactions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Enter the actual input/task to test. Optionally enable auto-generate to automatically generate 5 responses for entropy calculation.
            </Typography>
            <TextField
              label="Probe prompt (actual input/task to test)"
              placeholder="e.g., Complete this function: def process_data(data: List[Dict]) -> Dict:"
              value={probePrompt}
              onChange={e => setProbePrompt(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              required
              sx={{ mb: 1.5 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoGenerate}
                  onChange={e => setAutoGenerate(e.target.checked)}
                  disabled={loading}
                />
              }
              label={
                <span>
                  Auto-generate responses for entropy calculation (P<sub>t</sub> approximation)
                </span>
              }
              sx={{ mb: 1 }}
            />
            {autoGenerate && (
              <Box sx={{ mb: 2, pl: 4 }}>
                <TextField
                  label="Number of samples"
                  type="number"
                  value={sampleCount}
                  onChange={e => setSampleCount(Math.max(5, Math.min(50, parseInt(e.target.value) || 20)))}
                  size="small"
                  sx={{ width: 200, mr: 2 }}
                  helperText={
                    <span style={{ whiteSpace: 'nowrap' }}>
                      More samples = better P<sub>t</sub> approximation (5-50 recommended)
                    </span>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {sampleCount} responses will be generated to approximate the true model distribution (P<sub>t</sub>). Higher counts provide better temporal predictability estimates but take longer.
                </Typography>
              </Box>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Interactive Probe (Optional): Capture User Expectations (Q<sub>t</sub><sup>u</sup>)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Before running the probe, optionally record what you expect the system to do. This helps approximate your mental model (Q<sub>t</sub><sup>u</sup>) for more accurate C and L scores.
            </Typography>
            <TextField
              label="What do you expect the system to output? (optional)"
              placeholder="e.g., I expect it to complete the function with error handling..."
              value={expectedOutput}
              onChange={e => setExpectedOutput(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mb: 1, width: '100%' }}>
                Expected variation across repeated uses (0 = identical, 1 = completely different):
              </Typography>
              <Box sx={{ width: '60%', maxWidth: 400, mb: 1 }}>
                <Slider
                  value={expectedVariation !== null ? Math.max(0, Math.min(1, expectedVariation)) : 0.5}
                  min={0}
                  max={1}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0 (identical)' },
                    { value: 0.5, label: '0.5' },
                    { value: 1, label: '1 (different)' }
                  ]}
                  valueLabelDisplay="auto"
                  onChange={(_, v) => {
                    const clampedValue = Math.max(0, Math.min(1, v as number));
                    setExpectedVariation(clampedValue);
                  }}
                />
              </Box>
              <Button
                size="small"
                onClick={() => setExpectedVariation(null)}
                disabled={expectedVariation === null}
              >
                Clear
              </Button>
            </Box>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={() => handleAnalyze()}
                disabled={loading || !probePrompt.trim()}
              >
                {loading ? 'Analyzing…' : 'Run probe'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

      {/* Assessment */}
      <Typography variant="subtitle2" color="text.secondary">
        Step 3 · PSF assessment
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>PSF assessment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure a system profile and run a probe to see how the classifier positions the system on the Predictability Spectrum. Results include PSF level, T/C/L dimensions, modifier scores, and design guidance.
          </Typography>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Typography variant="body2">Running classification…</Typography>
            </Box>
          )}
          {!loading && error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
          {!loading && !error && lastResult && (
            <PSFVisualization
              result={{
                ...lastResult,
                metrics: calculatedMetrics
                  ? {
                      ...lastResult.metrics,
                      temporalEntropy: calculatedMetrics.temporalEntropy,
                      temporalVariationRate: calculatedMetrics.temporalVariationRate
                    }
                  : lastResult.metrics
              }}
              expected={profile.expected}
              intendedLevel={profile.intendedLevel}
              history={history}
              currentProbePrompt={probePrompt}
              onCalculateEntropy={handleCalculateEntropy}
              responseTexts={history && history.length > 0 ? history[history.length - 1].responseTexts : undefined}
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function CompareTab({ history }: { history: RunRecord[] }) {
  if (history.length < 2) {
    return (
      <Typography variant="body2" color="text.secondary">
        Run at least two probes in the Assess tab to compare baseline vs variant configurations.
      </Typography>
    );
  }

  const baseline = history[0];
  const variant = history[history.length - 1];
  const delta = {
    level: variant.result.level - baseline.result.level,
    T: variant.result.dimensions.T - baseline.result.dimensions.T,
    C: variant.result.dimensions.C - baseline.result.dimensions.C,
    L: variant.result.dimensions.L - baseline.result.dimensions.L
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Baseline
            </Typography>
            <Typography variant="h6">{baseline.profile.domain || 'Baseline configuration'}</Typography>
            <PSFVisualization result={baseline.result} />
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Variant
            </Typography>
            <Typography variant="h6">
              {variant.profile.domain || baseline.profile.domain || 'Variant configuration'}
            </Typography>
            <PSFVisualization result={variant.result} />
          </CardContent>
        </Card>
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="subtitle2">Differences (variant − baseline)</Typography>
          <Typography variant="body2">
            Level: {delta.level > 0 ? '+' : ''}
            {delta.level}
          </Typography>
          <Typography variant="body2">
            T: {delta.T.toFixed(2)} · C: {delta.C.toFixed(2)} · L: {delta.L.toFixed(2)}
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}

function DesignTab({ lastResult }: { lastResult: ClassificationResponse | null }) {
  const guidance = lastResult?.guidance ?? [];

  if (!lastResult) {
    return (
      <Typography variant="body2" color="text.secondary">
        Run a probe in the Assess tab to generate a PSF assessment. Design guidance will appear here
        based on the most recent run.
      </Typography>
    );
  }

  if (guidance.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No guidance items were returned by the backend for this run.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {guidance.map(item => (
        <Card key={item.id}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Chip label={`Level ${item.level}`} size="small" />
              <Chip label={item.category} size="small" variant="outlined" />
            </Stack>
            <Typography variant="subtitle2">{item.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {item.summary}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function ReflectTab({ history }: { history: RunRecord[] }) {
  const [selfReport, setSelfReport] = useState<SelfReport>({
    trust: 3,
    expectedVariation: 3,
    uncertaintyCommunication: 3,
    learnability: 3,
    checkingFrequency: 3
  });

  const last = history[history.length - 1];

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const total = history.length;
    const sums = history.reduce(
      (acc, run) => {
        acc.T += run.result.dimensions.T;
        acc.C += run.result.dimensions.C;
        acc.L += run.result.dimensions.L;
        return acc;
      },
      { T: 0, C: 0, L: 0 }
    );
    return {
      total,
      avgT: sums.T / total,
      avgC: sums.C / total,
      avgL: sums.L / total
    };
  }, [history]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick self-report (PSF-aligned)
          </Typography>
          {(['trust', 'expectedVariation', 'uncertaintyCommunication', 'learnability', 'checkingFrequency'] as const).map(
            key => (
              <Box key={key} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {key === 'trust' && 'Overall trust in outputs'}
                  {key === 'expectedVariation' && 'Expected variation across repeats'}
                  {key === 'uncertaintyCommunication' && 'Uncertainty communication'}
                  {key === 'learnability' && 'Learnability after repeated use'}
                  {key === 'checkingFrequency' && 'How often you must check outputs'}
                </Typography>
                <Slider
                  value={selfReport[key]}
                  min={1}
                  max={5}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  onChange={(_, v) =>
                    setSelfReport(prev => ({
                      ...prev,
                      [key]: v as number
                    }))
                  }
                />
              </Box>
            )
          )}
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Session snapshot
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Total runs: {stats.total}
            </Typography>
            <Typography variant="body2">Average dimensions (this session)</Typography>
            {[
              { key: 'T', label: 'Temporal (T)', value: stats.avgT },
              { key: 'C', label: 'Confidence (C)', value: stats.avgC },
              { key: 'L', label: 'Learning (L)', value: stats.avgL }
            ].map(dim => (
              <Box key={dim.key} sx={{ mb: 1 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">{dim.label}</Typography>
                  <Typography variant="caption">{dim.value.toFixed(2)}</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={valueToPercent(dim.value)}
                  sx={{ height: 6, borderRadius: 999 }}
                />
              </Box>
            ))}
            {last && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Last run vs your sliders
                </Typography>
                <Typography variant="body2">
                  Model level: {last.result.level} (T={last.result.dimensions.T.toFixed(2)}, C=
                  {last.result.dimensions.C.toFixed(2)}, L={last.result.dimensions.L.toFixed(2)})
                </Typography>
                <Typography variant="body2">
                  Your sliders: trust={selfReport.trust}, variation={selfReport.expectedVariation},
                  uncertainty={selfReport.uncertaintyCommunication}, learnability=
                  {selfReport.learnability}, checking={selfReport.checkingFrequency}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function PSFDesignLab() {
  const [activeTab, setActiveTab] = useState<'assess' | 'compare' | 'design' | 'reflect'>('assess');
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [lastResult, setLastResult] = useState<ClassificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Lift state from AssessTab to persist across tab switches
  const [profile, setProfile] = useState<SystemProfile>({
    domain: '',
    stakes: 'medium',
    expertise: 'intermediate',
    intendedLevel: 3,
    expected: { T: 0.6, C: 0.6, L: 0.6 },
    keyModifiers: ['O', 'I']
  });
  const [probePrompt, setProbePrompt] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [sampleCount, setSampleCount] = useState(20);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [expectedVariation, setExpectedVariation] = useState<number | null>(null);
  const [calculatedMetrics, setCalculatedMetrics] = useState<{
    temporalEntropy?: number;
    temporalVariationRate?: number;
  } | null>(null);

  const hasAnyRuns = history.length > 0;
  const hasAtLeastTwoRuns = history.length > 1;

  const runProbe = async (
    profile: SystemProfile,
    prompt: string,
    responseTexts?: string[],
    userExpectations?: {
      expectedOutput?: string;
      expectedVariation?: number;
      expectedConfidence?: number;
    },
    sampleCount?: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      // System description sent to Gemini (no hints about expected scores, intended level, or user expertise)
      // We exclude expertise to get a raw, unbiased assessment of the system's predictability
      const systemDescription = [
        profile.domain && `Domain: ${profile.domain}`,
        `Stakes: ${profile.stakes}`,
        profile.keyModifiers.length > 0 &&
          `Key modifiers: ${profile.keyModifiers.join(', ')}`
      ]
        .filter(Boolean)
        .join(' | ');

      // Use first response for classification, or all responses if provided
      const responseForClassification = responseTexts && responseTexts.length > 0 
        ? responseTexts[0] 
        : undefined;

      const res = await fetch('http://localhost:4000/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemDescription,
          prompt,
          response: responseForClassification,
          responseSamples: responseTexts, // Send all responses for entropy calculation
          profile: {
            stakes: profile.stakes,
            expertise: profile.expertise,
            confidenceBadges: profile.keyModifiers.includes('O'),
            interruptButton: profile.keyModifiers.includes('I'),
            safeMode: profile.keyModifiers.includes('S'),
            rationaleView: profile.keyModifiers.includes('A')
          },
          userExpectations, // Send user expectations for Q_t^u approximation
          sampleCount // Number of samples to generate for better P_t approximation
        })
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = (await res.json()) as ClassificationResponse;
      setLastResult(data);
      const record: RunRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        profile,
        probePrompt: prompt,
        responseTexts,
        result: data
      };
      setHistory(prev => [...prev, record]);
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (
    _event: React.SyntheticEvent,
    value: 'assess' | 'compare' | 'design' | 'reflect'
  ) => {
    if (value === 'compare' && !hasAtLeastTwoRuns) {
      return;
    }
    if ((value === 'design' || value === 'reflect') && !hasAnyRuns) {
      return;
    }
    setActiveTab(value);
  };

  return (
    <Stack spacing={3} sx={{ mt: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>
        PSF Design Lab
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }} color="text.secondary">
        An interactive companion to the paper: describe an AI surface, run probes, and explore PSF
        levels, T/C/L dimensions, and design guidance.
      </Typography>

      <Card>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600
            }
          }}
        >
          <Tab value="assess" label="Assess" />
          {hasAnyRuns ? (
            <Tab value="design" label="Design" />
          ) : (
            <Tooltip title="Run at least one probe in Assess to unlock this tab.">
              <span style={{ display: 'inline-flex' }}>
                <Tab value="design" label="Design" disabled />
              </span>
            </Tooltip>
          )}
          {hasAnyRuns ? (
            <Tab value="reflect" label="Reflect" />
          ) : (
            <Tooltip title="Run at least one probe in Assess to unlock this tab.">
              <span style={{ display: 'inline-flex' }}>
                <Tab value="reflect" label="Reflect" disabled />
              </span>
            </Tooltip>
          )}
          {hasAtLeastTwoRuns ? (
            <Tab value="compare" label="Compare" />
          ) : (
            <Tooltip title="Run at least two probes in Assess to unlock this tab.">
              <span style={{ display: 'inline-flex' }}>
                <Tab value="compare" label="Compare" disabled />
              </span>
            </Tooltip>
          )}
        </Tabs>
      </Card>

      {activeTab === 'assess' && (
        <AssessTab 
          onRun={runProbe} 
          lastResult={lastResult} 
          loading={loading} 
          error={error} 
          history={history}
          profile={profile}
          setProfile={setProfile}
          probePrompt={probePrompt}
          setProbePrompt={setProbePrompt}
          autoGenerate={autoGenerate}
          setAutoGenerate={setAutoGenerate}
          sampleCount={sampleCount}
          setSampleCount={setSampleCount}
          expectedOutput={expectedOutput}
          setExpectedOutput={setExpectedOutput}
          expectedVariation={expectedVariation}
          setExpectedVariation={setExpectedVariation}
          calculatedMetrics={calculatedMetrics}
          setCalculatedMetrics={setCalculatedMetrics}
        />
      )}
      {activeTab === 'design' && <DesignTab lastResult={lastResult} />}
      {activeTab === 'reflect' && <ReflectTab history={history} />}
      {activeTab === 'compare' && <CompareTab history={history} />}
    </Stack>
  );
}

// ---------- Root App ----------

export default function App() {
  const [pageTab, setPageTab] = useState<'overview' | 'lab' | 'docs'>('overview');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        backgroundImage: 'linear-gradient(135deg, #f5f3ff, #e0f2fe)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        py: 6
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Tabs
            value={pageTab}
            onChange={(_e, v) => setPageTab(v)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600
              }
            }}
          >
            <Tab value="overview" label="Framework overview" />
            <Tab value="docs" label="Design Lab Guidelines" />
            <Tab value="lab" label="PSF Design Lab" />
          </Tabs>

          {pageTab === 'overview' && <PSFOverview />}
          {pageTab === 'lab' && <PSFDesignLab />}
          {pageTab === 'docs' && <DesignLabDocs />}
        </Stack>
      </Container>
    </Box>
  );
}


