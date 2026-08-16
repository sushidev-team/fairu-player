import { defineConfig } from 'vite';
import { baseConfig, PORTS } from '../../shared/vite.base';

export default defineConfig(baseConfig('plain', PORTS.plain));
