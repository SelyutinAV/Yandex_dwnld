import React from 'react';

interface ProgressBarProps {
    overallProgress: number; // Общий прогресс (например, 300 из 4000)
    overallTotal: number;
    currentProgress?: number; // Прогресс текущего файла (0-100%)
    currentFileName?: string;
    currentStatus?: string; // Статус текущего файла (processing, downloading)
    isActive: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    overallProgress,
    overallTotal,
    currentProgress: _currentProgress = 0,
    currentFileName = '',
    currentStatus = '',
    isActive
}) => {
    const overallPercentage = overallTotal > 0 ? (overallProgress / overallTotal) * 100 : 0;

    // Всегда показываем статусную строку, но делаем её неактивной когда нет загрузки

    return (
        <div className={`border border-gray-200 rounded-lg p-4 mb-4 shadow-sm transition-all duration-300 ${isActive
                ? 'bg-white border-blue-200 shadow-md'
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}>
            <div className="space-y-3">
                {/* Общий прогресс загрузки */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className={`text-sm font-medium ${isActive ? 'text-gray-700' : 'text-gray-500'}`}>
                            📥 {isActive ? 'Загрузка файлов из очереди' : 'Очередь загрузки'}
                        </span>
                        <span className="text-sm text-gray-600">
                            {overallProgress} из {overallTotal} ({overallPercentage.toFixed(1)}%)
                        </span>
                    </div>
                    <div className={`w-full rounded-full h-3 ${isActive ? 'bg-gray-200' : 'bg-gray-100'}`}>
                        <div
                            className={`h-3 rounded-full transition-all duration-300 ease-out ${isActive
                                    ? 'bg-blue-600'
                                    : overallProgress > 0
                                        ? 'bg-gray-400'
                                        : 'bg-transparent'
                                }`}
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Убираем отображение текущего файла - он показывается в плашке трека */}

                {/* Статус */}
                {isActive && (
                    <div className="flex items-center justify-center">
                        <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-600">
                                {overallProgress < overallTotal ? 'Загружается...' : 'Завершено!'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
