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
   - User expertise (novice/intermediate/expert)
   - UI features (O, I, S, A modifiers)
3. In **Step 2 - Probing Interactions**:
   - Enter a probe prompt (actual input to test)
   - Optionally enable "Auto-generate 5 responses" for entropy calculation
4. Click **"Run probe"** to get:
   - PSF level (1-5)
   - T/C/L dimension scores
   - Modifier scores
   - Design guidance
   - Rationale explaining the classification

### Browser Extension

1. Click the extension icon in your browser toolbar
2. Fill in system profile and probe prompt
3. Click "Analyze" to get PSF assessment
4. View results in the extension popup

## How It Works

### Proxy Measurement Method

The toolkit uses **Gemini as an automated proxy classifier** to estimate T/C/L scores. This is an approximation method, not an exact computation of the mathematical formulas from the paper.

**Why proxy methods?** The paper's mathematical definitions require:
- **P_t**: True model distribution (often unavailable for closed-source systems)
- **Q_t^u**: User mental models (difficult to measure directly)

The toolkit uses Gemini to analyze system descriptions and responses, similar to the "interactive mental-model probes" mentioned in Section 2.4 of the paper. This provides:
- Approximate T/C/L scores for classification
- Trend identification (is predictability increasing/decreasing?)
- Level assignment (1-5) based on thresholds

For production deployments, teams should use the instrumentation methods described in the paper (entropy tracking, calibration metrics, user feedback logs) for more precise measurements.

### Classification Process

1. **System Description**: User provides domain, stakes, expertise, UI features
2. **Probe**: User provides a prompt and optionally example responses
3. **Gemini Analysis**: Gemini estimates T/C/L scores and assigns a PSF level
4. **Modifier Computation**: Backend computes modifier scores based on UI features
5. **Guidance Generation**: System generates design recommendations
6. **Results**: User sees classification, rationale, and guidance

## API Endpoints

### `POST /api/classify`

Classify an AI system and get PSF assessment.

**Request Body:**
```typescript
{
  systemDescription: string;
  prompt: string;
  response?: string;
  responseSamples?: string[];
  profile?: {
    stakes: 'low' | 'medium' | 'high';
    expertise: 'novice' | 'intermediate' | 'expert';
    confidenceBadges?: boolean;
    interruptButton?: boolean;
    safeMode?: boolean;
    rationaleView?: boolean;
  }
}
```

**Response:**
```typescript
{
  level: 1 | 2 | 3 | 4 | 5;
  dimensions: { T: number; C: number; L: number };
  overallScore: number;
  modifiers: { O: number; I: number; X: number; Lp: number; F: number; S: number; A: number; D: number };
  metrics?: { temporalEntropy?: number; temporalVariationRate?: number };
  rationale?: { overall?: string; T?: string; C?: string; L?: string; cues?: string[] };
  guidance?: Array<{ id: string; title: string; summary: string; category: string; level: number }>;
  notes?: string[];
}
```

### `POST /api/generate-responses`

Generate multiple responses for entropy calculation.

**Request Body:**
```typescript
{
  prompt: string;
  systemDescription?: string;
  count?: number;  // Default: 5
}
```

**Response:**
```typescript
{
  responses: string[];
}
```

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

## Limitations

- **Proxy Method**: Uses Gemini as an approximation, not exact mathematical computation
- **Rate Limits**: Free tier Gemini API has rate limits (10 requests/minute)
- **Single Model**: Currently only supports Gemini (extensible to other models)




@article{chaudhari2025predictability,
  title={Towards a Predictability Spectrum: A Framework for Understanding AI Behavior Predictability in Human-Computer Interaction},
  author={Chaudhari, Param and Majmudar, Yashas},
  journal={[Journal Name]},
  year={2025}
}
```

## Related Resources


- **Design Guidelines**: See the "Design Lab Guidelines" tab in the web app
- **Example Inputs**: See `example-inputs.txt` for usage examples
