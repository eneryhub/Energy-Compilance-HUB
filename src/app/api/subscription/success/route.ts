import { NextRequest, NextResponse } from 'next/server'

// GET /api/subscription/success?session_id=xxx
// Stripe redirects here after successful checkout.
// We show a confirmation page and redirect user to dashboard.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const canceled = req.nextUrl.searchParams.get('canceled')

  if (canceled) {
    // User canceled payment — redirect back with message
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '/'
    return NextResponse.redirect(`${baseUrl}?payment=canceled`)
  }

  // Render a simple HTML confirmation page that:
  // 1. Shows a success message
  // 2. Polls subscription status until it's ACTIVE
  // 3. Redirects to dashboard
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Exitoso - Energy-Compliance Hub</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes spin { to { transform: rotate(360deg) } }
    .spinner { animation: spin 1s linear infinite; }
  </style>
</head>
<body class="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
  <div class="max-w-md w-full text-center">
    <div class="bg-white rounded-2xl shadow-xl p-8 border border-emerald-100">
      <div id="loading-state">
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-emerald-600 spinner" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-800 mb-2">Procesando tu pago...</h1>
        <p class="text-slate-500 text-sm">Estamos activando tu suscripción. Esto puede tomar unos segundos.</p>
      </div>

      <div id="success-state" class="hidden">
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-800 mb-2">&#x2705; &#x00a1;Pago exitoso!</h1>
        <p class="text-slate-500 text-sm mb-6">Tu suscripción ha sido activada correctamente.</p>
        <a href="${baseUrl}/dashboard" class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
          Ir al Dashboard
        </a>
      </div>

      <div id="error-state" class="hidden">
        <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <svg class="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-slate-800 mb-2">Pago recibido</h1>
        <p class="text-slate-500 text-sm mb-6">Tu pago fue procesado. La activación puede tardar hasta 1 minuto.</p>
        <a href="${baseUrl}/dashboard" class="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
          Ir al Dashboard
        </a>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const token = localStorage.getItem('ech_token');
      const maxAttempts = 20;
      let attempts = 0;

      function checkStatus() {
        if (!token || attempts >= maxAttempts) {
          document.getElementById('loading-state').classList.add('hidden');
          document.getElementById('error-state').classList.remove('hidden');
          return;
        }

        attempts++;
        fetch('${baseUrl}/api/subscription/status', {
          headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(r => r.json())
        .then(data => {
          if (data.isActive && data.status === 'ACTIVE') {
            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('success-state').classList.remove('hidden');
          } else {
            setTimeout(checkStatus, 2000);
          }
        })
        .catch(() => {
          setTimeout(checkStatus, 2000);
        });
      }

      // Start polling after 3 seconds (give webhook time to process)
      setTimeout(checkStatus, 3000);
    })();
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
