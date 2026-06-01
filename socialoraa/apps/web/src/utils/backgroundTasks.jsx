import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const BackgroundTaskContext = createContext(null);

const initialTask = {
  status: "idle",
  message: "",
  progress: 0,
  startedAt: null,
  estimatedDurationMs: null,
  result: null,
  error: null,
  promise: null,
  completedAt: null,
  bannerVisible: false,
};

const store = {
  tasks: {},
  timers: {},
  successTimers: {},
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

const updateTaskProgress = (key, progress, message) => {
  const current = store.tasks[key];
  if (!current || current.status !== "running") return;

  setTask(key, {
    progress: Math.min(Math.max(Number(progress), current.progress || 0), 99),
    ...(message ? { message } : {}),
  });
};

const clearTask = (key) => {
  if (store.timers[key]) {
    globalThis.clearInterval(store.timers[key]);
    delete store.timers[key];
  }
  if (store.successTimers[key]) {
    globalThis.clearTimeout(store.successTimers[key]);
    delete store.successTimers[key];
  }
  setTask(key, initialTask);
};

const stopProgressTimer = (key) => {
  if (!store.timers[key]) return;
  globalThis.clearInterval(store.timers[key]);
  delete store.timers[key];
};

const hideCompletedBanners = () => {
  Object.entries(store.tasks).forEach(([taskKey, task]) => {
    if (task.status === "success" && task.bannerVisible) {
      setTask(taskKey, { bannerVisible: false });
    }
  });
};

const showSuccessBriefly = (key, durationMs) => {
  if (store.successTimers[key]) {
    globalThis.clearTimeout(store.successTimers[key]);
  }

  store.successTimers[key] = globalThis.setTimeout(() => {
    const task = store.tasks[key];
    if (task?.status === "success") {
      setTask(key, { bannerVisible: false });
    }
    delete store.successTimers[key];
  }, durationMs);
};

const startProgressTimer = (key, options = {}) => {
  stopProgressTimer(key);

  const maxProgress = Number(options.maxProgress ?? 94);
  const estimatedDurationMs = Number(options.estimatedDurationMs ?? 90000);
  const initialProgress = Number(options.initialProgress ?? 6);
  const startedAt = Date.now();

  setTask(key, {
    progress: initialProgress,
    startedAt,
    estimatedDurationMs,
  });

  store.timers[key] = globalThis.setInterval(() => {
    const task = store.tasks[key];
    if (!task || task.status !== "running") {
      stopProgressTimer(key);
      return;
    }

    const elapsed = Date.now() - startedAt;
    const ratio = Math.min(Math.max(elapsed / estimatedDurationMs, 0), 1);
    const eased = 1 - Math.pow(1 - ratio, 2.8);
    const nextProgress = Math.min(
      maxProgress,
      Math.max(
        task.progress || 0,
        Math.round(initialProgress + eased * (maxProgress - initialProgress)),
      ),
    );

    if (nextProgress !== task.progress) {
      setTask(key, { progress: nextProgress });
    }
  }, Number(options.progressIntervalMs ?? 900));
};

const runTask = async (key, runner, options = {}) => {
  const current = store.tasks[key];
  if (current?.status === "running" && current.promise) {
    return current.promise;
  }

  const promise = (async () => {
    hideCompletedBanners();
    setTask(key, {
      status: "running",
      message: options.message || "Processing...",
      progress: Number(options.initialProgress ?? 6),
      startedAt: Date.now(),
      estimatedDurationMs: Number(options.estimatedDurationMs ?? 90000),
      error: null,
      completedAt: null,
      bannerVisible: true,
    });
    startProgressTimer(key, options);

    try {
      const result = await runner({
        setProgress: (progress, message) => updateTaskProgress(key, progress, message),
        setMessage: (message) => setTask(key, { message }),
      });
      stopProgressTimer(key);
      const successVisibleMs = Number(options.successVisibleMs ?? 1200);
      setTask(key, {
        status: "success",
        message: options.successMessage || "Complete",
        progress: 100,
        result,
        error: null,
        promise: null,
        completedAt: Date.now(),
        bannerVisible: true,
      });
      showSuccessBriefly(key, successVisibleMs);
      return result;
    } catch (error) {
      stopProgressTimer(key);
      setTask(key, {
        status: "error",
        message: "",
        progress: 0,
        error,
        promise: null,
        completedAt: null,
        bannerVisible: false,
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
