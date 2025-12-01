import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: '#1a73e8' // Material-like blue
      },
      secondary: {
        main: '#ff8a65'
      },
      background: {
        default: mode === 'light' ? '#f5f5f7' : '#050509',
        paper: mode === 'light' ? '#ffffff' : '#121212'
      }
    },
    shape: {
      borderRadius: 12
    },
    typography: {
      fontFamily: [
        'Roboto',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'sans-serif'
      ].join(','),
      h5: {
        fontWeight: 600
      }
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16
          }
        }
      }
    }
  });

