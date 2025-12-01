# Predictability Spectrum Framework (PSF) Design Lab

An interactive toolkit for assessing AI system predictability using the Predictability Spectrum Framework. This toolkit provides a web application, API server, and browser extension to help designers and researchers evaluate and design AI systems across five levels of predictability.

## Overview

The PSF Design Lab operationalizes the Predictability Spectrum Framework by providing:
- **System Assessment**: Classify AI systems into PSF levels (1-5) with T/C/L dimension scores
- **Design Guidance**: Get actionable design recommendations tailored to each predictability level
- **Comparison Tools**: Compare different system configurations side-by-side
- **Reflection & Analysis**: Track assessment history and analyze predictability trends

## Repository Structure

```
toolkit/
├── core/           # Shared TypeScript contracts and types
├── api/            # Backend API server (Express + Gemini integration)
├── web/            # React web application (PSF Design Lab)
├── extension/      # Browser extension (Chrome/Edge)
└── README.md       # This file
```

### Components

- **`core/`**: Shared TypeScript library defining API contracts, types, and interfaces used across all components
- **`api/`**: Node.js/Express backend server that:
  - Integrates with Gemini API for PSF classification
  - Computes modifier scores and design guidance
  - Calculates temporal metrics (entropy, variation rate)
  - Provides `/api/classify` and `/api/generate-responses` endpoints
- **`web/`**: React + TypeScript web application with Material UI:
  - Framework overview and documentation
  - Interactive PSF Design Lab (Assess, Design, Reflect, Compare tabs)
  - System profiling, probing, and visualization
- **`extension/`**: Browser extension (Manifest V3) for quick PSF assessments from any webpage

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Gemini API key (get one from [Google AI Studio](https://ai.google.dev/))

### 1. Install Dependencies

```bash
# Install core library dependencies
cd core
npm install

# Install API server dependencies
cd ../api
npm install

# Install web app dependencies
cd ../web
npm install

# Install extension dependencies (optional)
cd ../extension
npm install
```

### 2. Configure API Key

Create a `.env` file in `toolkit/api/`:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash  # Optional: defaults to gemini-2.5-flash
PORT=4000                      # Optional: defaults to 4000
```

### 3. Start the API Server

```bash
cd toolkit/api
npm run dev
```

The API server will start on `http://localhost:4000`

### 4. Start the Web Application

```bash
cd toolkit/web
npm run dev
```

The web app will be available at `http://localhost:5173` (or the port Vite assigns)

### 5. Build the Browser Extension (Optional)

```bash
cd toolkit/extension
npm run build
```

Then load the `extension/dist/` folder in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `toolkit/extension/dist/`

## Usage

### Web Application

1. **Framework Overview**: Learn about the PSF levels, dimensions, and modifier traits
2. **Design Lab Guidelines**: Read comprehensive documentation on using the toolkit
3. **PSF Design Lab**: 
   - **Assess Tab**: Profile your system, run probes, and get PSF classifications
   - **Design Tab**: View actionable design guidance based on assessments
   - **Reflect Tab**: Review assessment history and self-report predictability perceptions
   - **Compare Tab**: Compare multiple system configurations side-by-side

### Example Workflow

1. Go to the **Assess** tab
2. Fill in **Step 1 - System Profile**:
   - Domain/task description
   - Stakes (low/medium/high)
   - User expertise (novice/intermediate/expert) - used for modifier calculations and design guidance only, excluded from classification for unbiased assessment
   - UI features (O, I, S, A modifiers)
3. In **Step 2 - Probing Interactions**:
   - Enter a probe prompt (actual input to test)
   - Optionally enable "Auto-generate responses" to generate multiple responses (5-50, default: 20) for entropy calculation
   - Optionally fill in Interactive Probe fields:
     - **Expected output**: What you expect the system to produce (used for Q_t^u mental model)
     - **Expected variation**: Slider (0-1) indicating expected variation across repeated uses
4. Click **"Run probe"** to get:
   - PSF level (1-5)
   - T/C/L dimension scores (computed using exact formulas when data available, otherwise proxy methods)
   - Temporal metrics (entropy and variation rate) if response samples provided
   - Modifier scores (O, I, X, Lp, F, S, A, D)
   - Design guidance tailored to your system's level and context
   - Rationale explaining the classification
   - Comparison view (if you set assumptions in Step 1)

### Browser Extension

1. Click the extension icon in your browser toolbar
2. Fill in system profile and probe prompt
3. Click "Analyze" to get PSF assessment
4. View results in the extension popup

## How It Works

### Hybrid Measurement Approach

The toolkit uses a **hybrid approach** combining exact mathematical formulas (when data is available) with proxy methods (when direct measurement is infeasible).

#### Exact Formulas (When Data Available)

When response samples and user expectations are provided:
- **T (Temporal)**: Uses exact Shannon entropy formula: `H = -Σ p log₂(p)`, normalized to `T = 1 - H/H_max`
- **C (Confidence)**: Uses exact formula: `C = Σ P_t(x) Q_t^u(x) / Σ P_t(x)` for outcomes above median probability
- **L (Learning)**: Uses exact KL divergence: `L = exp(-λ · D_KL(P_t || Q_t^u))` where `λ = 1/H_max`

#### Proxy Methods (When Data Missing)

When direct access to P_t or Q_t^u is unavailable:
- **Gemini as Proxy Classifier**: Analyzes system descriptions and responses to estimate T/C/L scores
- **Semantic Understanding**: Uses LLM's understanding of system behavior patterns
- **Blended Approach**: When both exact and proxy methods are available, blends 50% exact + 50% proxy for robustness

**Why hybrid?** The mathematical definitions require:
- **P_t**: True model distribution (often unavailable for closed-source systems)
- **Q_t^u**: User mental models (difficult to measure directly)

The toolkit provides mathematical rigor when possible, while gracefully falling back to proxy methods when direct measurement is infeasible.

### Classification Process

1. **System Description**: User provides domain, stakes, UI features
   - **Sent to Gemini**: Domain, stakes, UI features (for unbiased classification)
   - **Excluded from Gemini**: User expertise, assumed level, assumption T/C/L (to prevent bias)
   - **Used for Modifiers/Guidance**: Expertise, stakes, UI features (deterministic server-side calculations)

2. **Probe**: User provides a prompt and optionally:
   - **Response samples**: Multiple responses for entropy calculation (P_t approximation)
   - **User expectations**: Expected output and variation (Q_t^u approximation) via Interactive Probe

3. **Temporal Metrics**: If response samples provided, calculates:
   - **Entropy**: Normalized Shannon entropy `H/H_max` (0 = deterministic, 1 = maximum randomness)
   - **Variation Rate**: Proportion of distinct outputs vs total samples

4. **Gemini Analysis**: Gemini estimates T/C/L scores and assigns a PSF level based on system description and probe results

5. **Exact Formula Computation**: If response samples and user expectations provided:
   - Constructs empirical P_t distribution from response samples
   - Constructs Q_t^u distribution from user expectations
   - Computes exact C and L formulas, blends with Gemini estimates

6. **Modifier Computation**: Backend computes modifier scores (O, I, X, Lp, F, S, A, D) based on:
   - UI features (O, I, S, A directly controlled)
   - Stakes (affects S modifier)
   - Expertise (affects O and F modifiers)
   - System-level properties (X, Lp, F, D computed automatically)

7. **Guidance Generation**: System generates design recommendations based on:
   - PSF level and T/C/L scores
   - Modifier scores
   - Stakes and expertise (for context-appropriate guidance)

8. **Results**: User sees classification, rationale, temporal metrics, modifier scores, and guidance

## API Endpoints

### `POST /api/classify`

Classify an AI system and get PSF assessment.

**Request Body:**
```typescript
{
  systemDescription: string;  // Domain, stakes, UI features (expertise excluded)
  prompt: string;
  response?: string;  // Single response for classification
  responseSamples?: string[];  // Multiple responses for entropy calculation (P_t approximation)
  userExpectations?: {
    expectedOutput?: string;  // User's expected output (for Q_t^u construction)
    expectedVariation?: number;  // Expected variation [0,1] (for Q_t^u construction)
    expectedConfidence?: number;
  };
  profile?: {
    stakes: 'low' | 'medium' | 'high';  // Used for modifiers and guidance
    expertise: 'novice' | 'intermediate' | 'expert';  // Used for modifiers and guidance only, NOT sent to Gemini
    confidenceBadges?: boolean;  // Maps to O modifier
    interruptButton?: boolean;  // Maps to I modifier
    safeMode?: boolean;  // Maps to S modifier
    rationaleView?: boolean;  // Maps to A modifier
  };
  sampleCount?: number;  // Number of samples to generate (5-50)
}
```

**Note**: `systemDescription` sent to Gemini excludes user expertise to ensure unbiased classification. Expertise is still used in the `profile` object for modifier calculations and design guidance.

**Response:**
```typescript
{
  level: 1 | 2 | 3 | 4 | 5;  // PSF predictability level
  dimensions: { 
    T: number;  // Temporal predictability [0,1]
    C: number;  // Confidence predictability [0,1]
    L: number;  // Learning predictability [0,1]
  };
  overallScore: number;  // Weighted average of T/C/L (default: equal weights)
  modifiers: { 
    O: number;  // Observability [0,1]
    I: number;  // Intervention [0,1]
    X: number;  // Cross-context consistency [0,1]
    Lp: number; // Latency predictability [0,1]
    F: number;  // Feedback responsiveness [0,1]
    S: number;  // Safety posture [0,1]
    A: number;  // Social alignment [0,1]
    D: number;  // External context drift [0,1]
  };
  metrics?: { 
    temporalEntropy?: number;  // Normalized entropy H/H_max [0,1]
    temporalVariationRate?: number;  // Distinct outputs / total samples [0,1]
    temporalStabilityFromClassifier?: number;  // Stability across multiple classifications [0,1]
  };
  rationale?: { 
    overall?: string; 
    T?: string; 
    C?: string; 
    L?: string; 
    cues?: string[];  // Textual cues that influenced classification
  };
  guidance?: Array<{ 
    id: string; 
    title: string; 
    summary: string; 
    category: 'interface' | 'explanation' | 'trust' | 'transition';
    level: number;
  }>;
  notes?: string[];
}
```

### `POST /api/generate-responses`

Generate multiple responses for entropy calculation (P_t approximation). This endpoint simulates what the evaluated system might produce by calling Gemini with the probe prompt multiple times.

**Request Body:**
```typescript
{
  prompt: string;  // The probe prompt to test
  systemDescription?: string;  // Domain and stakes (expertise excluded)
  count?: number;  // Number of responses to generate (default: 5, recommended: 20-50)
}
```

**Response:**
```typescript
{
  responses: string[];  // Array of generated responses
}
```

**Use Case**: When you don't have access to the actual system's responses, this endpoint generates multiple responses to approximate the system's output distribution (P_t). More samples provide better entropy estimates but take longer.

## Development

### Building

```bash
# Build core library
cd core
npm run build

# Build web app
cd web
npm run build

# Build extension
cd extension
npm run build
```

### Project Structure

- **TypeScript** is used throughout for type safety
- **Shared contracts** in `core/src/contracts.ts` ensure API consistency
- **Material UI v5** with Material 3 theme for the web app
- **Vite** for fast development and building
- **Express** for the API server
- **Manifest V3** for the browser extension

## Example Inputs

See `example-inputs.txt` for example system profiles and probe prompts.

## Key Features

### Unbiased Classification
- **Expertise excluded from classification**: User expertise is not sent to Gemini to ensure raw, unbiased assessment of system predictability
- **Independent assessment**: Assumed levels and assumption T/C/L scores are kept separate and not sent to Gemini
- **Raw system testing**: Classification reflects actual system behavior, not user assumptions

### Mathematical Rigor
- **Exact formulas when possible**: Uses exact Shannon entropy, KL divergence, and confidence formulas when response samples and user expectations are available
- **Hybrid approach**: Blends exact formulas (50%) with Gemini estimates (50%) when both are available for robustness
- **Temporal metrics**: Calculates normalized entropy and variation rate from response samples

### Interactive Mental Model Probes
- **Q_t^u approximation**: Users can provide expected output and expected variation to construct their mental model
- **Improved C and L accuracy**: When user expectations provided, uses exact formulas for Confidence and Learning predictability
- **Optional but recommended**: Interactive Probe fields improve accuracy but are not required

### Design Guidance
- **Context-aware**: Guidance adapts based on stakes, expertise, and modifier scores
- **Level-specific**: Different recommendations for each PSF level (1-5)
- **Category-organized**: Guidance organized by interface, explanation, trust, and transition patterns

## Limitations

- **Hybrid Approach**: Uses exact formulas when data available, falls back to Gemini proxy when not
- **Rate Limits**: Free tier Gemini API has rate limits (10 requests/minute)
- **Single Model**: Currently only supports Gemini (extensible to other models)
- **Sampling Approximation**: P_t approximated from 20-50 samples (more samples = better but slower)




## Related Resources


- **Design Guidelines**: See the "Design Lab Guidelines" tab in the web app
- **Example Inputs**: See `example-inputs.txt` for usage examples
