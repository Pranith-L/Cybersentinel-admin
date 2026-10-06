import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function devSymposiumApiPlugin() {
  return {
    name: 'dev-symposium-api',
    configureServer(server) {
      server.middlewares.use('/api/symposium-registrations', async (req, res) => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rkmzrgektehctcozagnk.supabase.co';
          const SERVICE_KEY =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXpyZ2VrdGVoY3Rjb3phZ25rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTQzNDkzMSwiZXhwIjoyMTA1MDEwOTMxfQ.Ck6er3J5k7W7oJk-SfxUsFIWN4RPZxE7P8jgvdQI0L0';
          const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const [regRes, sumRes] = await Promise.all([
            supabase
              .from('registrations')
              .select(
                'id, registration_code, selected_day, status, created_at, payments(status), selected_event_registrations(event_id, events(id, code, name, day, event_type)), special_event_registrations(special_event_id, special_events(id, code, name))'
              )
              .order('created_at', { ascending: true }),
            supabase.from('admin_registration_summary').select('*').single(),
          ]);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ registrations: regRes.data || [], summary: sumRes.data || null }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), devSymposiumApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-qr': ['html5-qrcode', 'qrcode'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
