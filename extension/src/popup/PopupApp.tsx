import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Stack,
  Slider,
  IconButton,
  Divider,
  Chip,
  LinearProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import type {
  ClassificationInput,
  ClassificationOutput,
  SystemProfilePayload,
} from 'psf-toolkit-core/dist/contracts.js';

const API_BASE = 'http://localhost:4000';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function PopupApp() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationOutput | null>(null);
  const [responseSamples, setResponseSamples] = useState<string[] | undefined>(undefined);

  // System profile state
  const [domain, setDomain] = useState('');
  const [stakes, setStakes] = useState<'low' | 'medium' | 'high'>('medium');
  const [expertise, setExpertise] = useState<'novice' | 'intermediate' | 'expert'>('intermediate');
  const [confidenceBadges, setConfidenceBadges] = useState(false);
  const [interruptButton, setInterruptButton] = useState(false);
  const [safeMode, setSafeMode] = useState(false);
  const [rationaleView, setRationaleView] = useState(false);

  // Probe state
  const [probePrompt, setProbePrompt] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [sampleCount, setSampleCount] = useState(20);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [expectedVariation, setExpectedVariation] = useState<number | null>(null);
  const [showOutputs, setShowOutputs] = useState(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAnalyze = async () => {
    if (!probePrompt.trim()) {
      setError('Please enter a probe prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile: SystemProfilePayload = {
        stakes,
        expertise,
        confidenceBadges,
        interruptButton,
        safeMode,
        rationaleView,
      };

      let responseTexts: string[] | undefined;
      
      // Auto-generate responses if enabled
      if (autoGenerate) {
        try {
          const systemDescription = domain || 'Unspecified AI system';
          const genRes = await fetch(`${API_BASE}/api/generate-responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: probePrompt,
              systemDescription,
              count: sampleCount
            })
          });
          
          if (genRes.ok) {
            const genData = await genRes.json() as { responses: string[] };
            responseTexts = genData.responses;
          }
        } catch (err) {
          console.error('Error generating responses:', err);
        }
      }

      const userExpectations = (expectedOutput || expectedVariation !== null) ? {
        expectedOutput: expectedOutput || undefined,
        expectedVariation: expectedVariation !== null ? expectedVariation : undefined,
      } : undefined;

      const input: ClassificationInput = {
        systemDescription: domain || 'Unspecified AI system',
        prompt: probePrompt,
        response: responseTexts && responseTexts.length > 0 ? responseTexts[0] : undefined,
        responseSamples: responseTexts,
        profile,
        userExpectations,
        sampleCount: autoGenerate ? sampleCount : undefined,
      };

      const response = await fetch(`${API_BASE}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data: ClassificationOutput = await response.json();
      setResult(data);
      setResponseSamples(responseTexts); // Store separately for display
      setTabValue(1); // Switch to results tab
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <Typography variant="h5" gutterBottom align="center" fontWeight="bold">
        PSF Design Lab
      </Typography>

      <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
        <Tab label="Assess" />
        <Tab label="Results" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Stack spacing={2}>
          <Typography variant="h6">System Profile</Typography>

          <TextField
            label="Domain / task"
            fullWidth
            size="small"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g., IDE code completion assistant"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Stakes of mistakes</InputLabel>
            <Select value={stakes} onChange={(e) => setStakes(e.target.value as any)} label="Stakes of mistakes">
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>User expertise</InputLabel>
            <Select value={expertise} onChange={(e) => setExpertise(e.target.value as any)} label="User expertise">
              <MenuItem value="novice">Novice</MenuItem>
              <MenuItem value="intermediate">Intermediate</MenuItem>
              <MenuItem value="expert">Expert</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>UI Features</Typography>
          <FormControlLabel
            control={<Checkbox checked={confidenceBadges} onChange={(e) => setConfidenceBadges(e.target.checked)} />}
            label="Confidence badges (O)"
          />
          <FormControlLabel
            control={<Checkbox checked={interruptButton} onChange={(e) => setInterruptButton(e.target.checked)} />}
            label="Interrupt button (I)"
          />
          <FormControlLabel
            control={<Checkbox checked={safeMode} onChange={(e) => setSafeMode(e.target.checked)} />}
            label="Safe mode (S)"
          />
          <FormControlLabel
            control={<Checkbox checked={rationaleView} onChange={(e) => setRationaleView(e.target.checked)} />}
            label="Rationale view (A)"
          />

          <Typography variant="h6" sx={{ mt: 2 }}>Probe</Typography>
          <TextField
            label="Probe prompt (actual input/task to test)"
            fullWidth
            multiline
            rows={3}
            size="small"
            value={probePrompt}
            onChange={(e) => setProbePrompt(e.target.value)}
            placeholder="e.g., Complete this function: def process_data(data: List[Dict]) -> Dict:"
            required
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                disabled={loading}
              />
            }
            label={
              <span>
                Auto-generate responses for entropy calculation (P<sub>t</sub> approximation)
              </span>
            }
          />
          
          {autoGenerate && (
            <Box sx={{ pl: 4 }}>
              <TextField
                label="Number of samples"
                type="number"
                value={sampleCount}
                onChange={(e) => setSampleCount(Math.max(5, Math.min(50, parseInt(e.target.value) || 20)))}
                size="small"
                sx={{ width: 120 }}
                helperText="5-50 recommended"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {sampleCount} responses will be generated to approximate P<sub>t</sub> and improve classification.
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Interactive Probe (Optional): Capture User Expectations (Q<sub>t</sub><sup>u</sup>)
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Optionally record what you expect to improve C and L accuracy.
          </Typography>
          
          <TextField
            label="What do you expect the system to output? (optional)"
            fullWidth
            multiline
            rows={2}
            size="small"
            value={expectedOutput}
            onChange={(e) => setExpectedOutput(e.target.value)}
            placeholder="e.g., I expect it to complete the function with error handling..."
            sx={{ mb: 1.5 }}
          />
          
          <Box>
            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
              Expected variation (0 = identical, 1 = different):
            </Typography>
            <Slider
              value={expectedVariation !== null ? Math.max(0, Math.min(1, expectedVariation)) : 0.5}
              min={0}
              max={1}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 0.5, label: '0.5' },
                { value: 1, label: '1' }
              ]}
              valueLabelDisplay="auto"
              onChange={(_, v) => {
                const clampedValue = Math.max(0, Math.min(1, v as number));
                setExpectedVariation(clampedValue);
              }}
              sx={{ mb: 0.5 }}
            />
            <Button
              size="small"
              onClick={() => setExpectedVariation(null)}
              disabled={expectedVariation === null}
            >
              Clear
            </Button>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            fullWidth
            onClick={handleAnalyze}
            disabled={loading || !probePrompt.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {result ? (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={`Level ${result.level}`} size="small" sx={{ fontWeight: 600 }} />
                  <Typography variant="body2">
                    Overall: {result.overallScore.toFixed(2)}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Core Dimensions</Typography>
                {(['T', 'C', 'L'] as const).map(key => (
                  <Box key={key} sx={{ mb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">
                        {key === 'T' && 'Temporal (T)'}
                        {key === 'C' && 'Confidence (C)'}
                        {key === 'L' && 'Learning (L)'}
                      </Typography>
                      <Typography variant="caption">{result.dimensions[key].toFixed(2)}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={result.dimensions[key] * 100}
                      sx={{ height: 6, borderRadius: 999 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>

            {result.metrics && (result.metrics.temporalEntropy !== undefined ||
              result.metrics.temporalVariationRate !== undefined) && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Temporal Metrics (P<sub>t</sub> Approximation)
                  </Typography>
                  <Typography variant="body2">
                    <strong>Entropy:</strong> {result.metrics.temporalEntropy?.toFixed(3) ?? '–'}
                    {' · '}
                    <strong>Variation Rate:</strong> {result.metrics.temporalVariationRate?.toFixed(3) ?? '–'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Lower entropy = more predictable outputs.
                  </Typography>
                </CardContent>
              </Card>
            )}

            {responseSamples && responseSamples.length > 0 && (
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="subtitle1">
                      AI System Output{responseSamples.length > 1 ? 's' : ''}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => setShowOutputs(!showOutputs)}
                      sx={{ p: 0.5 }}
                    >
                      {showOutputs ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                    <Typography variant="caption" color="text.secondary">
                      ({responseSamples.length})
                    </Typography>
                  </Stack>
                  {showOutputs && (
                    <Box sx={{ mt: 1 }}>
                      {responseSamples.length === 1 ? (
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                            bgcolor: 'action.hover',
                            p: 1,
                            borderRadius: 1,
                            fontSize: '0.875rem',
                            maxHeight: 200,
                            overflow: 'auto'
                          }}
                        >
                          {responseSamples[0]}
                        </Typography>
                      ) : (
                        <Stack spacing={1}>
                          {responseSamples.slice(0, 3).map((response, idx) => (
                            <Box key={idx}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                Response {idx + 1}:
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  fontFamily: 'monospace',
                                  bgcolor: 'action.hover',
                                  p: 1,
                                  borderRadius: 1,
                                  fontSize: '0.875rem',
                                  maxHeight: 150,
                                  overflow: 'auto'
                                }}
                              >
                                {response}
                              </Typography>
                            </Box>
                          ))}
                          {responseSamples.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                              ... and {responseSamples.length - 3} more
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {result.rationale && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Rationale</Typography>
                  {result.rationale.overall && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {result.rationale.overall}
                    </Typography>
                  )}
                  {(result.rationale.T || result.rationale.C || result.rationale.L) && (
                    <Stack spacing={0.5}>
                      {result.rationale.T && (
                        <Typography variant="caption" display="block">
                          <strong>T:</strong> {result.rationale.T}
                        </Typography>
                      )}
                      {result.rationale.C && (
                        <Typography variant="caption" display="block">
                          <strong>C:</strong> {result.rationale.C}
                        </Typography>
                      )}
                      {result.rationale.L && (
                        <Typography variant="caption" display="block">
                          <strong>L:</strong> {result.rationale.L}
                        </Typography>
                      )}
                    </Stack>
                  )}
                  {result.rationale.cues && result.rationale.cues.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                      {result.rationale.cues.map(cue => (
                        <Chip key={cue} label={cue} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {result.notes && result.notes.length > 0 && (
              <Alert severity="info">
                {result.notes.map((note, i) => (
                  <Typography key={i} variant="body2" sx={{ mb: i < result.notes!.length - 1 ? 0.5 : 0 }}>
                    {note}
                  </Typography>
                ))}
              </Alert>
            )}

            {result.guidance && result.guidance.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Design Guidance</Typography>
                  <Stack spacing={1}>
                    {result.guidance.slice(0, 3).map(item => (
                      <Box key={item.id}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                          <Chip label={`Level ${item.level}`} size="small" />
                          <Chip label={item.category} size="small" variant="outlined" />
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.875rem' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.summary}
                        </Typography>
                      </Box>
                    ))}
                    {result.guidance.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        ... and {result.guidance.length - 3} more guidance items
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" align="center">
            Run an analysis to see results here
          </Typography>
        )}
      </TabPanel>
    </Container>
  );
}

