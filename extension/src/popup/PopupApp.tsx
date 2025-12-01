import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
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
  const [responseText, setResponseText] = useState('');

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

      const input: ClassificationInput = {
        systemDescription: domain || 'Unspecified AI system',
        prompt: probePrompt,
        response: responseText || undefined,
        profile,
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
            label="Probe prompt"
            fullWidth
            multiline
            rows={3}
            size="small"
            value={probePrompt}
            onChange={(e) => setProbePrompt(e.target.value)}
            placeholder="Enter a prompt to test the system"
          />

          <TextField
            label="Response (optional)"
            fullWidth
            multiline
            rows={3}
            size="small"
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Paste AI response here, or leave blank"
          />

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
                <Typography variant="h6">PSF Level: {result.level}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Score: {(result.overallScore * 100).toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Dimensions</Typography>
                <Typography variant="body2">T: {(result.dimensions.T * 100).toFixed(1)}%</Typography>
                <Typography variant="body2">C: {(result.dimensions.C * 100).toFixed(1)}%</Typography>
                <Typography variant="body2">L: {(result.dimensions.L * 100).toFixed(1)}%</Typography>
              </CardContent>
            </Card>

            {result.rationale && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Rationale</Typography>
                  <Typography variant="body2">{result.rationale.overall}</Typography>
                </CardContent>
              </Card>
            )}

            {result.notes && result.notes.length > 0 && (
              <Alert severity="info">
                {result.notes.map((note, i) => (
                  <Typography key={i} variant="body2">
                    {note}
                  </Typography>
                ))}
              </Alert>
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

