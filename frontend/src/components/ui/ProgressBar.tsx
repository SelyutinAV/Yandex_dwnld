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
    currentProgress = 0,
    currentFileName,
    currentStatus,
    isActive
}) => {
    // ТОЧКА КОНТРОЛЯ: Логируем изменения в ProgressBar
    React.useEffect(() => {
        console.log('📊 ProgressBar рендер:', {
            overallProgress,
            overallTotal,
            isActive,
            percentage: overallTotal > 0 ? Math.min((overallProgress / overallTotal) * 100, 100) : 0,
            timestamp: new Date().toISOString()
        })
    }, [overallProgress, overallTotal, isActive])

    // Рассчитываем процент общего прогресса
    const overallPercentage = overallTotal > 0 ? Math.min((overallProgress / overallTotal) * 100, 100) : 0;

    // Форматируем числа для отображения
    const formatNumber = (num: number) => {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 mb-4 shadow-sm min-h-[80px] flex flex-col justify-center bg-white">
            <div className="space-y-3">
                {/* Общий прогресс загрузки */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            📥 Загрузка файлов из очереди
                        </span>
                        <span className="text-sm text-gray-600">
                            {formatNumber(overallProgress)} из {formatNumber(overallTotal)} ({overallPercentage.toFixed(1)}%)
                        </span>
                    </div>
                    <div className="w-full rounded-full h-3 bg-gray-200">
                        <div
                            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                </div>
                
            </div>
        </div>
    );
};
