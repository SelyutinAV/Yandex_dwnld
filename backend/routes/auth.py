"""Роуты для аутентификации"""

from fastapi import APIRouter, HTTPException

from config.database import update_yandex_client
from db_manager import db_manager
from models.token import DualTokenTest, TokenTest
from services.subscription_service import check_subscription_status
from yandex_client import YandexMusicClient

router = APIRouter()


@router.post("/test")
async def test_token(request: TokenTest):
    """Тестирование токена"""
    try:
        # Создаем временный клиент для проверки
        test_client = YandexMusicClient(request.token)
        success = test_client.connect()

        if success:
            # Определяем тип токена
            token_type = "oauth" if request.token.startswith("y0_") else "session_id"

            # Сохраняем токен в базу данных
            try:
                # Сохраняем в новую таблицу токенов
                db_manager.save_token(
                    "Основной токен", request.token, token_type, is_active=True
                )
                # Также сохраняем в старую таблицу для совместимости
                db_manager.save_setting("yandex_token", request.token)
            except Exception as db_error:
                print(f"Ошибка сохранения токена в БД: {db_error}")

            # Обновляем глобальный клиент
            update_yandex_client(request.token)
            return {"status": "success", "message": "Подключение успешно"}
        else:
            print(f"Токен не прошел проверку: {request.token[:20]}...")
            raise HTTPException(
                status_code=401,
                detail="Не удалось подключиться к Яндекс.Музыке. Проверьте правильность токена.",
            )
    except Exception as e:
        print(f"Ошибка проверки токена: {e}")
        raise HTTPException(status_code=401, detail=f"Ошибка проверки токена: {str(e)}")


@router.post("/test-dual")
async def test_dual_tokens(request: DualTokenTest):
    """Тестирование обоих токенов (OAuth и Session ID)"""
    try:
        # Проверяем OAuth токен
        oauth_client = YandexMusicClient(request.oauth_token)
        oauth_success = oauth_client.connect()

        # Проверяем Session ID токен
        session_client = YandexMusicClient(request.session_id_token)
        session_success = session_client.connect()

        if oauth_success and session_success:
            # Оба токена работают - проверяем подписку через OAuth (приоритет)
            has_subscription, has_lossless_access, subscription_dict = (
                check_subscription_status(oauth_client)
            )

            # Если через OAuth не получилось, пробуем через Session ID
            if not has_subscription:
                print("Пробуем проверить подписку через Session ID клиент...")
                has_subscription, has_lossless_access, subscription_dict = (
                    check_subscription_status(session_client)
                )

            return {
                "status": "success",
                "message": "Оба токена работают корректно",
                "oauth_valid": True,
                "session_id_valid": True,
                "has_subscription": has_subscription,
                "has_lossless_access": has_lossless_access,
                "subscription_details": subscription_dict,
            }
        elif oauth_success:
            # Только OAuth работает - проверяем подписку через OAuth
            has_subscription, has_lossless_access, subscription_dict = (
                check_subscription_status(oauth_client)
            )

            return {
                "status": "partial",
                "message": ("OAuth токен работает, но Session ID токен недействителен"),
                "oauth_valid": True,
                "session_id_valid": False,
                "has_subscription": has_subscription,
                "has_lossless_access": has_lossless_access,
                "subscription_details": subscription_dict,
            }
        elif session_success:
            # Только Session ID работает - проверяем подписку через Session ID
            print("OAuth не работает, проверяем подписку через Session ID...")
            has_subscription, has_lossless_access, subscription_dict = (
                check_subscription_status(session_client)
            )

            return {
                "status": "partial",
                "message": (
                    "Session ID токен работает, " "но OAuth токен недействителен"
                ),
                "oauth_valid": False,
                "session_id_valid": True,
                "has_subscription": has_subscription,
                "has_lossless_access": has_lossless_access,
                "subscription_details": subscription_dict,
            }
        else:
            raise HTTPException(status_code=401, detail="Оба токена недействительны")

    except Exception as e:
        print(f"Ошибка проверки токенов: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=401, detail=f"Ошибка проверки токенов: {str(e)}"
        )


@router.get("/guide")
async def get_token_guide():
    """Получить инструкцию по получению токена"""
    return {
        "steps": [
            {
                "number": 1,
                "title": "Откройте Яндекс.Музыку",
                "description": "Перейдите на сайт Яндекс.Музыки и авторизуйтесь в своем аккаунте",
                "action": "Перейти на music.yandex.ru",
                "url": "https://music.yandex.ru",
            },
            {
                "number": 2,
                "title": "Откройте DevTools",
                "description": "Нажмите F12 или Ctrl+Shift+I для открытия инструментов разработчика",
                "action": "Открыть DevTools",
            },
            {
                "number": 3,
                "title": "Перейдите на вкладку Network",
                "description": "В DevTools найдите вкладку Network (Сеть)",
                "action": "Кликните на Network",
            },
            {
                "number": 4,
                "title": "Очистите список запросов",
                "description": "Нажмите кнопку очистки (🚫) для очистки списка запросов",
                "action": "Очистить список",
            },
            {
                "number": 5,
                "title": "Обновите страницу",
                "description": "Нажмите F5 или Ctrl+R для обновления страницы",
                "action": "Обновить страницу",
            },
            {
                "number": 6,
                "title": "Найдите запрос к API",
                "description": "В списке запросов найдите любой запрос к api.music.yandex.ru",
                "action": "Найти запрос",
            },
            {
                "number": 7,
                "title": "Откройте вкладку Headers",
                "description": "Кликните на запрос и перейдите на вкладку Headers",
                "action": "Открыть Headers",
            },
            {
                "number": 8,
                "title": "Скопируйте токен",
                "description": "В разделе Request Headers найдите заголовок Authorization и скопируйте значение токена",
                "action": "Скопировать токен",
            },
        ]
    }

