#!/bin/bash

echo "🎯 Проверка нового прогресс-бара загрузки..."
echo ""

# Проверяем что бэкенд работает
if ! curl -s "http://localhost:8000/api/health" > /dev/null; then
    echo "❌ Бэкенд не отвечает на http://localhost:8000"
    exit 1
fi

echo "✅ Бэкенд работает"
echo ""

# Проверяем новый API прогресса
echo "📊 Проверяем API прогресса:"
progress_data=$(curl -s "http://localhost:8000/api/downloads/progress")
echo "$progress_data" | jq .

echo ""
echo "📈 Анализ данных:"
overall_progress=$(echo "$progress_data" | jq -r '.overall_progress')
overall_total=$(echo "$progress_data" | jq -r '.overall_total')
current_track=$(echo "$progress_data" | jq -r '.current_track')
current_progress=$(echo "$progress_data" | jq -r '.current_progress')
is_active=$(echo "$progress_data" | jq -r '.is_active')

overall_percentage=$(echo "scale=1; $overall_progress * 100 / $overall_total" | bc)

echo "   • Общий прогресс: $overall_progress из $overall_total ($overall_percentage%)"
echo "   • Текущий трек: $current_track"
echo "   • Прогресс текущего: $current_progress%"
echo "   • Активна загрузка: $is_active"

echo ""
echo "🎨 Тестовые файлы:"
echo "   • test_progress.html - визуальный тест прогресс-бара"
echo "   • test_api.html - полный тест API с прогрессом"

echo ""
echo "🚀 Для тестирования в браузере:"
echo "   1. Откройте file:///home/urch/Projects/yandex_downloads/test_progress.html"
echo "   2. Или file:///home/urch/Projects/yandex_downloads/test_api.html"
echo "   3. Или обновите http://localhost:3000 (может потребоваться Ctrl+Shift+R)"

echo ""
echo "✨ Новый прогресс-бар показывает:"
echo "   📥 Общий прогресс загрузки файлов из очереди"
echo "   🎵 Прогресс текущего загружающегося файла"
echo "   📍 Расположен ближе к списку и кнопкам управления"
echo "   🔄 Обновляется в реальном времени"
