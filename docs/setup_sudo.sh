#!/bin/bash

# Скрипт для настройки sudo без пароля для команд разработки

echo "🔐 Настройка sudo для команд разработки..."

# Получаем имя пользователя
USERNAME=$(whoami)
echo "Пользователь: $USERNAME"

# Команды, которым разрешаем выполнение без пароля
COMMANDS="/usr/bin/apt,/usr/bin/dpkg,/usr/bin/pip,/usr/bin/pip3,/usr/bin/npm,/usr/bin/yarn,/usr/bin/node,/usr/bin/python,/usr/bin/python3,/sbin/service,/bin/systemctl,/usr/bin/cursor"

# Создаем временный файл с правилом
TEMP_SUDOERS="/tmp/cursor_sudoers"
cat > "$TEMP_SUDOERS" << EOF
# Cursor development commands
$USERNAME ALL=(ALL) NOPASSWD: $COMMANDS
EOF

echo "📝 Создано правило для sudoers:"
cat "$TEMP_SUDOERS"

echo ""
echo "⚠️  ВНИМАНИЕ: Для применения изменений нужно выполнить:"
echo "sudo cp $TEMP_SUDOERS /etc/sudoers.d/cursor"
echo "sudo chmod 440 /etc/sudoers.d/cursor"

# Предлагаем автоматически применить
read -p "Применить изменения автоматически? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Применяем изменения..."
    sudo cp "$TEMP_SUDOERS" /etc/sudoers.d/cursor
    sudo chmod 440 /etc/sudoers.d/cursor
    echo "✅ Готово! Теперь команды разработки будут выполняться без запроса пароля."
else
    echo "📋 Выполните команды вручную:"
    echo "sudo cp $TEMP_SUDOERS /etc/sudoers.d/cursor"
    echo "sudo chmod 440 /etc/sudoers.d/cursor"
fi

# Удаляем временный файл
rm "$TEMP_SUDOERS"
