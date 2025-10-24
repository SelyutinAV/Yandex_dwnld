"""
Утилиты для определения и стандартизации качества аудио
"""
import os
from typing import Dict, Optional, Tuple
from enum import Enum

class AudioQuality(Enum):
    """Стандартизированные уровни качества аудио"""
    LOSSLESS = "Lossless"
    HIGH = "High Quality"
    MEDIUM = "Medium Quality"
    LOW = "Low Quality"
    UNKNOWN = "Unknown Quality"

class AudioFormat(Enum):
    """Форматы аудио"""
    FLAC = "FLAC"
    MP3 = "MP3"
    AAC = "AAC"
    M4A = "M4A"
    OGG = "OGG"
    UNKNOWN = "Unknown"

def determine_audio_quality(file_path: str) -> Dict[str, str]:
    """
    Определяет качество аудио файла и возвращает стандартизированную информацию
    
    Args:
        file_path: Путь к аудио файлу
        
    Returns:
        Словарь с информацией о качестве:
        {
            'format': 'FLAC'|'MP3'|'AAC'|...,
            'quality_level': 'Lossless'|'High Quality'|'Medium Quality'|'Low Quality',
            'quality_string': '16-bit/48.0kHz'|'320kbps/44.1kHz'|...,
            'bitrate': '320kbps'|'160kbps'|None,
            'sample_rate': '48.0kHz'|'44.1kHz'|None,
            'bit_depth': '16-bit'|'24-bit'|None
        }
    """
    try:
        extension = os.path.splitext(file_path)[1].lower()[1:]
        
        if extension == 'flac':
            return _analyze_flac_file(file_path)
        elif extension == 'mp3':
            return _analyze_mp3_file(file_path)
        elif extension in ['aac', 'm4a']:
            return _analyze_aac_file(file_path)
        else:
            return _get_unknown_quality(extension)
            
    except Exception as e:
        print(f"Ошибка анализа качества файла {file_path}: {e}")
        return _get_unknown_quality("unknown")

def _analyze_flac_file(file_path: str) -> Dict[str, str]:
    """Анализ FLAC файла"""
    try:
        from mutagen.flac import FLAC
        audio = FLAC(file_path)
        
        if audio.info:
            bit_depth = audio.info.bits_per_sample
            sample_rate = audio.info.sample_rate
            
            quality_string = f"{bit_depth}-bit/{sample_rate / 1000}kHz"
            quality_level = AudioQuality.LOSSLESS.value
            
            return {
                'format': AudioFormat.FLAC.value,
                'quality_level': quality_level,
                'quality_string': quality_string,
                'bitrate': None,  # FLAC не использует битрейт
                'sample_rate': f"{sample_rate / 1000}kHz",
                'bit_depth': f"{bit_depth}-bit"
            }
    except ImportError:
        pass
    except Exception as e:
        print(f"Ошибка анализа FLAC файла: {e}")
    
    return _get_unknown_quality("flac")

def _analyze_mp3_file(file_path: str) -> Dict[str, str]:
    """Анализ MP3 файла"""
    try:
        from mutagen.mp3 import MP3
        audio = MP3(file_path)
        
        if audio.info:
            bitrate = audio.info.bitrate // 1000  # в kbps
            sample_rate = audio.info.sample_rate
            
            quality_string = f"{bitrate}kbps/{sample_rate / 1000}kHz"
            quality_level = _determine_mp3_quality_level(bitrate)
            
            return {
                'format': AudioFormat.MP3.value,
                'quality_level': quality_level,
                'quality_string': quality_string,
                'bitrate': f"{bitrate}kbps",
                'sample_rate': f"{sample_rate / 1000}kHz",
                'bit_depth': None  # MP3 не имеет фиксированной битовой глубины
            }
    except ImportError:
        pass
    except Exception as e:
        print(f"Ошибка анализа MP3 файла: {e}")
    
    return _get_unknown_quality("mp3")

def _analyze_aac_file(file_path: str) -> Dict[str, str]:
    """Анализ AAC/M4A файла"""
    try:
        from mutagen.mp4 import MP4
        audio = MP4(file_path)
        
        if audio.info:
            bitrate = audio.info.bitrate // 1000  # в kbps
            sample_rate = audio.info.sample_rate
            
            quality_string = f"{bitrate}kbps/{sample_rate / 1000}kHz"
            quality_level = _determine_aac_quality_level(bitrate)
            
            return {
                'format': AudioFormat.AAC.value,
                'quality_level': quality_level,
                'quality_string': quality_string,
                'bitrate': f"{bitrate}kbps",
                'sample_rate': f"{sample_rate / 1000}kHz",
                'bit_depth': None
            }
    except ImportError:
        pass
    except Exception as e:
        print(f"Ошибка анализа AAC файла: {e}")
    
    return _get_unknown_quality("aac")

def _determine_mp3_quality_level(bitrate: int) -> str:
    """Определяет уровень качества для MP3 на основе битрейта"""
    if bitrate >= 320:
        return AudioQuality.HIGH.value
    elif bitrate >= 256:
        return AudioQuality.MEDIUM.value
    elif bitrate >= 128:
        return AudioQuality.LOW.value
    else:
        return AudioQuality.UNKNOWN.value

def _determine_aac_quality_level(bitrate: int) -> str:
    """Определяет уровень качества для AAC на основе битрейта"""
    if bitrate >= 256:
        return AudioQuality.HIGH.value
    elif bitrate >= 128:
        return AudioQuality.MEDIUM.value
    elif bitrate >= 96:
        return AudioQuality.LOW.value
    else:
        return AudioQuality.UNKNOWN.value

def _get_unknown_quality(format_ext: str) -> Dict[str, str]:
    """Возвращает неизвестное качество для формата"""
    return {
        'format': format_ext.upper() if format_ext != "unknown" else AudioFormat.UNKNOWN.value,
        'quality_level': AudioQuality.UNKNOWN.value,
        'quality_string': f"{format_ext.upper()} Audio",
        'bitrate': None,
        'sample_rate': None,
        'bit_depth': None
    }

def get_quality_badge_color(quality_string: str) -> str:
    """
    Возвращает CSS классы для цветовой индикации качества
    Учитывает и битрейт, и частоту дискретизации для точного определения качества
    
    Args:
        quality_string: Строка качества (например, "24-bit/48.0kHz", "320kbps/44.1kHz")
        
    Returns:
        CSS классы для стилизации
    """
    # Извлекаем параметры качества
    bit_depth = 0
    sample_rate = 0
    bitrate = 0
    
    # Парсим битовую глубину
    if '24-bit' in quality_string:
        bit_depth = 24
    elif '16-bit' in quality_string:
        bit_depth = 16
    elif '32-bit' in quality_string:
        bit_depth = 32
    
    # Парсим частоту дискретизации
    if '48.0kHz' in quality_string or '48kHz' in quality_string:
        sample_rate = 48000
    elif '44.1kHz' in quality_string or '44kHz' in quality_string:
        sample_rate = 44100
    elif '32kHz' in quality_string:
        sample_rate = 32000
    elif '22kHz' in quality_string:
        sample_rate = 22000
    
    # Парсим битрейт
    import re
    bitrate_match = re.search(r'(\d+)kbps', quality_string)
    if bitrate_match:
        bitrate = int(bitrate_match.group(1))
    else:
        bitrate_match = re.search(r'(\d+)(?=\/)', quality_string)
        if bitrate_match:
            bitrate = int(bitrate_match.group(1))
    
    # Определяем цвет на основе качества - упрощенная и логичная схема
    if bit_depth > 0:  # Lossless качество - фиолетовый (лучшее)
        return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
    elif bitrate > 0:  # Сжатое качество
        # Логичная цветовая прогрессия: зеленый -> синий -> желтый -> красный
        if bitrate >= 320:  # 320kbps - зеленый (отличное)
            return 'bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg'
        elif bitrate >= 296:  # 296kbps - бирюзовый (очень хорошее)
            return 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg'
        elif bitrate >= 256:  # 256kbps - синий (хорошее)
            return 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
        elif bitrate >= 224:  # 224kbps - голубой (хорошее)
            return 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg'
        elif bitrate >= 192:  # 192kbps - светло-синий (среднее)
            return 'bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-lg'
        elif bitrate >= 160:  # 160kbps - желто-зеленый (среднее)
            return 'bg-gradient-to-r from-lime-600 to-green-600 text-white shadow-lg'
        elif bitrate >= 128:  # 128kbps - желтый (низкое)
            return 'bg-gradient-to-r from-yellow-600 to-amber-700 text-white shadow-lg'
        elif bitrate >= 96:   # 96kbps - оранжевый (очень низкое)
            return 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
        else:  # Менее 96kbps - красный (плохое)
            return 'bg-gradient-to-r from-red-600 to-red-800 text-white shadow-lg'
    else:
        return 'bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg'

def get_quality_sort_order(quality_string: str) -> int:
    """
    Возвращает порядок сортировки качества (меньше = лучше)
    Учитывает битовую глубину и частоту дискретизации для точной сортировки
    
    Args:
        quality_string: Строка качества (например, "24-bit/48.0kHz", "320kbps/44.1kHz")
        
    Returns:
        Число для сортировки (меньше = лучше)
    """
    # Извлекаем параметры качества
    bit_depth = 0
    sample_rate = 0
    bitrate = 0
    
    # Парсим битовую глубину
    if '24-bit' in quality_string:
        bit_depth = 24
    elif '16-bit' in quality_string:
        bit_depth = 16
    elif '32-bit' in quality_string:
        bit_depth = 32
    
    # Парсим частоту дискретизации
    if '48.0kHz' in quality_string or '48kHz' in quality_string:
        sample_rate = 48000
    elif '44.1kHz' in quality_string or '44kHz' in quality_string:
        sample_rate = 44100
    elif '32kHz' in quality_string:
        sample_rate = 32000
    elif '22kHz' in quality_string:
        sample_rate = 22000
    
    # Парсим битрейт - используем регулярные выражения для извлечения числа
    import re
    bitrate_match = re.search(r'(\d+)kbps', quality_string)
    if bitrate_match:
        bitrate = int(bitrate_match.group(1))
    else:
        # Попробуем найти число без kbps
        bitrate_match = re.search(r'(\d+)(?=\/)', quality_string)
        if bitrate_match:
            bitrate = int(bitrate_match.group(1))
    
    # Определяем порядок сортировки
    if bit_depth > 0:  # Lossless качество
        # Для lossless: 24-bit/48kHz лучше чем 16-bit/44.1kHz
        if bit_depth == 24 and sample_rate >= 48000:
            return 1  # Лучшее lossless
        elif bit_depth == 24 and sample_rate >= 44100:
            return 2  # Хорошее lossless
        elif bit_depth == 16 and sample_rate >= 48000:
            return 3  # Стандартное lossless высокое
        elif bit_depth == 16 and sample_rate >= 44100:
            return 4  # Стандартное lossless
        else:
            return 5  # Другое lossless
    elif bitrate > 0:  # Сжатое качество
        # Для сжатого: выше битрейт = лучше
        # Используем обратную сортировку: чем выше битрейт, тем меньше номер (лучше)
        # Формула: 6 + (1000 - bitrate) для максимально точной сортировки
        return 6 + (1000 - bitrate)  # 320kbps = 686, 296kbps = 710, 256kbps = 750, etc.
    else:
        return 11  # Неизвестное качество

def standardize_yandex_quality(yandex_quality: str) -> Dict[str, str]:
    """
    Стандартизирует качество, полученное от Yandex API
    
    Args:
        yandex_quality: Качество от Yandex API ('lossless', 'hq', 'nq')
        
    Returns:
        Стандартизированная информация о качестве
    """
    if yandex_quality == 'lossless':
        return {
            'format': AudioFormat.FLAC.value,
            'quality_level': AudioQuality.LOSSLESS.value,
            'quality_string': '16-bit/48.0kHz',
            'bitrate': None,
            'sample_rate': '48.0kHz',
            'bit_depth': '16-bit'
        }
    elif yandex_quality == 'hq':
        return {
            'format': AudioFormat.AAC.value,
            'quality_level': AudioQuality.HIGH.value,
            'quality_string': '320kbps/44.1kHz',
            'bitrate': '320kbps',
            'sample_rate': '44.1kHz',
            'bit_depth': None
        }
    elif yandex_quality == 'nq':
        return {
            'format': AudioFormat.AAC.value,
            'quality_level': AudioQuality.MEDIUM.value,
            'quality_string': '128kbps/44.1kHz',
            'bitrate': '128kbps',
            'sample_rate': '44.1kHz',
            'bit_depth': None
        }
    else:
        return _get_unknown_quality("unknown")
