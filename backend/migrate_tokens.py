#!/usr/bin/env python3
"""
Скрипт миграции токенов из старой структуры в новую единую структуру аккаунтов
"""

import sqlite3
import os
from datetime import datetime
from db_manager import DatabaseManager


def migrate_tokens_to_accounts():
    """Мигрирует токены из saved_tokens в yandex_accounts"""

    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    db_path = os.path.join(data_dir, "yandex_music.db")
    db_manager = DatabaseManager(db_path)

    print("🔄 Начинаем миграцию токенов...")

    # Получаем все токены из старой структуры
    old_tokens = db_manager.get_all_tokens()

    if not old_tokens:
        print("✅ Нет токенов для миграции")
        return

    print(f"📋 Найдено {len(old_tokens)} токенов для миграции")

    # Группируем токены по username (если есть)
    accounts_by_username = {}
    tokens_without_username = []

    for token in old_tokens:
        if token.get("username"):
            username = token["username"]
            if username not in accounts_by_username:
                accounts_by_username[username] = []
            accounts_by_username[username].append(token)
        else:
            tokens_without_username.append(token)

    migrated_count = 0

    # Мигрируем токены с username
    for username, tokens in accounts_by_username.items():
        print(f"👤 Мигрируем аккаунт пользователя: {username}")

        oauth_token = None
        session_id_token = None
        is_active = False

        # Собираем токены для одного аккаунта
        for token in tokens:
            if token["token_type"] == "oauth":
                oauth_token = token[
                    "token_preview"
                ]  # Используем preview, так как полный токен не возвращается
            elif token["token_type"] == "session_id":
                session_id_token = token["token_preview"]

            if token["is_active"]:
                is_active = True

        # Получаем полные токены из БД
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()

            # Получаем полные токены
            for token in tokens:
                cursor.execute(
                    "SELECT token FROM saved_tokens WHERE id = ?", (token["id"],)
                )
                row = cursor.fetchone()
                if row:
                    full_token = row[0]
                    if token["token_type"] == "oauth":
                        oauth_token = full_token
                    elif token["token_type"] == "session_id":
                        session_id_token = full_token

        # Создаем новый аккаунт
        account_id = db_manager.save_account(
            name=f"Аккаунт {username}",
            oauth_token=oauth_token,
            session_id_token=session_id_token,
            username=username,
            is_active=is_active,
        )

        print(f"✅ Создан аккаунт ID {account_id} для пользователя {username}")
        migrated_count += 1

    # Мигрируем токены без username
    for i, token in enumerate(tokens_without_username):
        print(f"🔑 Мигрируем токен без username: {token['name']}")

        # Получаем полный токен
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT token FROM saved_tokens WHERE id = ?", (token["id"],)
            )
            row = cursor.fetchone()
            if row:
                full_token = row[0]

                # Определяем тип токена
                token_type = token["token_type"]
                oauth_token = full_token if token_type == "oauth" else None
                session_id_token = full_token if token_type == "session_id" else None

                # Создаем аккаунт
                account_id = db_manager.save_account(
                    name=token["name"],
                    oauth_token=oauth_token,
                    session_id_token=session_id_token,
                    username=None,
                    is_active=token["is_active"],
                )

                print(f"✅ Создан аккаунт ID {account_id} для токена {token['name']}")
                migrated_count += 1

    print(f"🎉 Миграция завершена! Создано {migrated_count} аккаунтов")

    # Показываем результат
    new_accounts = db_manager.get_all_accounts()
    print(f"📊 Всего аккаунтов в новой структуре: {len(new_accounts)}")

    for account in new_accounts:
        print(
            f"  • {account['name']} (ID: {account['id']}, активен: {account['is_active']})"
        )


if __name__ == "__main__":
    migrate_tokens_to_accounts()
