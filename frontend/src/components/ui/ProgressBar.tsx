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

    if (!isActive) {
        return null;
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
            <div className="space-y-3">
                {/* Общий прогресс загрузки */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            📥 Загрузка файлов из очереди
                        </span>
                        <span className="text-sm text-gray-600">
                            {overallProgress} из {overallTotal} ({overallPercentage.toFixed(1)}%)
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Текущий обрабатываемый файл */}
                {currentFileName && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                {currentStatus === 'processing' ? (
                                    <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) : currentStatus === 'downloading' ? (
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                        <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {currentFileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {currentStatus === 'processing' ? '⚙️ Обработка...' :
                                        currentStatus === 'downloading' ? '⬇️ Загрузка...' :
                                            '🔄 Обработка...'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Статус */}
                <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-600">
                            {overallProgress < overallTotal ? 'Загружается...' : 'Завершено!'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
