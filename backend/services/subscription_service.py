"""Сервис для проверки статуса подписки"""

import json
from typing import Dict, Optional, Tuple

from yandex_client import YandexMusicClient


def check_subscription_status(
    client: YandexMusicClient,
) -> Tuple[bool, bool, Optional[Dict]]:
    """Проверка статуса подписки через клиент"""
    has_subscription = False
    has_lossless_access = False
    subscription_dict = None

    try:
        if client and client.client:
            account = client.client.account_status()
            subscription = account.subscription

            print(f"Full account status: {account}")
            print(f"Subscription object: {subscription}")
            print(f"Subscription is None: {subscription is None}")

            # Если subscription существует (не None), значит есть подписка
            if subscription is not None:
                has_subscription = True

                # Преобразуем subscription в словарь для сериализации
                subscription_dict = {}
                try:
                    if hasattr(subscription, "__dict__"):
                        # Фильтруем несериализуемые объекты
                        for key, value in subscription.__dict__.items():
                            try:
                                # Пробуем сериализовать значение
                                json.dumps(value)
                                subscription_dict[key] = value
                            except Exception:
                                # Если не сериализуется, преобразуем в строку
                                subscription_dict[key] = str(value)
                    elif hasattr(subscription, "items"):
                        subscription_dict = dict(subscription)
                    else:
                        # Пытаемся получить атрибуты
                        for attr in dir(subscription):
                            if not attr.startswith("_"):
                                try:
                                    value = getattr(subscription, attr)
                                    if not callable(value):
                                        try:
                                            json.dumps(value)
                                            subscription_dict[attr] = value
                                        except Exception:
                                            subscription_dict[attr] = str(value)
                                except Exception:
                                    pass
                except Exception as e:
                    print(f"Ошибка при преобразовании subscription: {e}")
                    subscription_dict = {"error": str(e)}

                print(f"Subscription dict: {subscription_dict}")

                # Проверяем все возможные поля подписки
                # для более точного определения
                subscription_active = (
                    subscription_dict.get("active", False)
                    or subscription_dict.get("auto_renewable", False)
                    or subscription_dict.get("non_auto_renewable", False)
                    or getattr(subscription, "active", False)
                    or getattr(subscription, "auto_renewable", False)
                    or getattr(subscription, "non_auto_renewable", False)
                )

                # Если есть активная подписка, проверяем lossless
                if subscription_active:
                    has_lossless_access = True
                else:
                    # Проверяем другие признаки подписки
                    has_subscription = (
                        subscription_dict.get("had_any_subscription", False)
                        or subscription_dict.get("can_start_trial", False)
                        or subscription_dict.get("provider", False)
                        or subscription_dict.get("family", False)
                        or getattr(subscription, "had_any_subscription", False)
                        or getattr(subscription, "can_start_trial", False)
                    )

                    # Если была подписка, но не активна,
                    # lossless может быть недоступен
                    has_lossless_access = subscription_active

                print(
                    f"Has subscription: {has_subscription}, "
                    f"Has lossless: {has_lossless_access}, "
                    f"Active: {subscription_active}"
                )
            else:
                print("Subscription is None - нет подписки")

    except Exception as e:
        print(f"Ошибка при проверке подписки: {e}")
        import traceback

        traceback.print_exc()
        # Если не удалось проверить, оставляем значения по умолчанию

    return has_subscription, has_lossless_access, subscription_dict

