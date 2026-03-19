#!/bin/bash
# ═══════════════════════════════════════
# Push Finance SCool a GitHub
# Repo: https://github.com/Arturo0214/finance-scool
# Ejecutar desde DENTRO de esta carpeta: ./push-to-github.sh
# ═══════════════════════════════════════

set -e
cd "$(dirname "$0")"
echo "📂 Directorio: $(pwd)"

# Inicializar git si no existe
if [ ! -d ".git" ]; then
  echo "🔧 Inicializando repositorio git..."
  git init
  git branch -M main
fi

# Asegurar remote
if ! git remote get-url origin &>/dev/null; then
  git remote add origin https://github.com/Arturo0214/finance-scool.git
else
  git remote set-url origin https://github.com/Arturo0214/finance-scool.git
fi

echo "📦 Agregando archivos..."
git add -A

echo "💾 Creando commit..."
git commit -m "Finance SCool - Full project (client + server + deploy configs)" --allow-empty || true

echo "🚀 Pushing a GitHub..."
git push -u origin main --force

echo ""
echo "✅ Finance SCool publicado en: https://github.com/Arturo0214/finance-scool"
