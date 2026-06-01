import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const BackgroundTaskContext = createContext(null);

const initialTask = {
  status: "idle",
  message: "",
  result: null,
  error: null,
  promise: null,
};

const store = {
  tasks: {},
  listeners: new Set(),
};

const getSnapshot = () => store.tasks;

const subscribe = (listener) => {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
};

const notify = () => {
  store.listeners.forEach((listener) => listener());
};

const setTask = (key, patch) => {
  store.tasks = {
    ...store.tasks,
    [key]: {
      ...(store.tasks[key] || initialTask),
      ...patch,
    },
  };
  notify();
};

const clearTask = (key) => {
  setTask(key, initialTask);
};

const runTask = async (key, runner, options = {}) => {
  const current = store.tasks[key];
  if (current?.status === "running" && current.promise) {
    return current.promise;
  }

  const promise = (async () => {
    setTask(key, {
      status: "running",
      message: options.message || "Processing...",
      error: null,
    });

    try {
      const result = await runner();
      setTask(key, {
        status: "success",
        message: options.successMessage || "Complete",
        result,
        error: null,
        promise: null,
      });
      return result;
    } catch (error) {
      setTask(key, {
        status: "error",
        message: "",
        error,
        promise: null,
      });
      throw error;
    }
  })();

  setTask(key, { promise });
  return promise;
};

export function BackgroundTaskProvider({ children }) {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const getTask = useCallback(
    (key) => tasks[key] || initialTask,
    [tasks],
  );

  const value = useMemo(
    () => ({
      tasks,
      runTask,
      clearTask,
      getTask,
    }),
    [getTask, tasks],
  );

  return (
    <BackgroundTaskContext.Provider value={value}>
      {children}
    </BackgroundTaskContext.Provider>
  );
}

export function useBackgroundTask(key) {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error("useBackgroundTask must be used inside BackgroundTaskProvider");
  }

  return {
    task: context.getTask(key),
    runTask: (runner, options) => context.runTask(key, runner, options),
    clearTask: () => context.clearTask(key),
  };
}

export function useBackgroundTasks() {
  const context = useContext(BackgroundTaskContext);
  if (!context) {
    throw new Error("useBackgroundTasks must be used inside BackgroundTaskProvider");
  }

  return context.tasks;
}
