import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react'

interface AppState {
    lastUpdate: string
    refreshTrigger: number
}

interface AppContextType {
    state: AppState
    triggerRefresh: () => void
    updateLastUpdate: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const useAppContext = () => {
    const context = useContext(AppContext)
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider')
    }
    return context
}

interface AppProviderProps {
    children: ReactNode
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [state, setState] = useState<AppState>({
        lastUpdate: new Date().toISOString(),
        refreshTrigger: 0
    })

    const triggerRefresh = useCallback(() => {
        setState(prev => ({
            ...prev,
            refreshTrigger: prev.refreshTrigger + 1,
            lastUpdate: new Date().toISOString()
        }))
    }, [])

    const updateLastUpdate = useCallback(() => {
        setState(prev => ({
            ...prev,
            lastUpdate: new Date().toISOString()
        }))
    }, [])

    const value: AppContextType = {
        state,
        triggerRefresh,
        updateLastUpdate
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}
