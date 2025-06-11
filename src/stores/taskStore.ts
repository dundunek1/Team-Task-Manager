import { defineStore } from "pinia";
import { ref } from "vue";
import { db } from "@/firebaseConfig";
import { Toaster, toast } from "vue-sonner";
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, serverTimestamp, deleteDoc, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

interface Task {
  id: string;
  name: string;
  status: string;
  date: string;
  groupCode: string;
  assignedTo?: string | null;
  isFavorite?: boolean;
  priority?: string | null;
  completion: number;
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
  statusUpdatedAt?: string; // ISO timestamp for when status was last changed
  createdBy?: string; // User ID who created the task
}

export const useTaskStore = defineStore("task", () => {
  const tasks = ref<Task[]>([]);
  const auth = getAuth();

  const saveActivityLog = async (taskId: string, changeType: string, oldValue: any, newValue: any) => {
    try {
      await addDoc(collection(db, "activity_logs"), {
        taskId,
        changeType, // e.g. "status_change", "completion_update", "assignment_change"
        oldValue,
        newValue,
        userId: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        groupCode: tasks.value.find((t) => t.id === taskId)?.groupCode,
      });
    } catch (error) {
      console.error("Error saving activity log:", error);
    }
  };

  const fetchTasksForGroup = (groupCode: string) => {
    console.log("Fetching tasks for group code:", groupCode);

    try {
      const tasksRef = collection(db, "tasks");
      const q = query(tasksRef, where("groupCode", "==", groupCode));

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          console.log(`Got ${querySnapshot.docs.length} tasks from Firestore`);

          tasks.value = querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || "Unnamed Task",
              status: data.status || "To Do",
              date: data.date || new Date().toLocaleDateString(),
              groupCode: data.groupCode,
              assignedTo: data.assignedTo,
              isFavorite: data.isFavorite || false,
              priority: data.priority || null,
              completion: data.completion || 0,
              createdAt: data.createdAt || data.date || new Date().toISOString(),
              updatedAt: data.updatedAt || data.date || new Date().toISOString(),
              statusUpdatedAt: data.statusUpdatedAt || data.updatedAt || new Date().toISOString(),
              createdBy: data.createdBy || auth.currentUser?.uid,
            };
          });

          console.log("Updated tasks:", tasks.value);
        },
        (error) => {
          console.error("Error fetching tasks:", error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up tasks listener:", error);
      return () => {};
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousStatus = task.status;
    const now = new Date().toISOString();

    // If moving to Completed, set completion to 100%
    const newCompletion = newStatus === "Completed" ? 100 : task.completion;

    tasks.value[taskIndex] = {
      ...task,
      status: newStatus,
      updatedAt: now,
      statusUpdatedAt: now,
      completion: newCompletion,
    };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        updatedAt: now,
        statusUpdatedAt: now,
        completion: newCompletion,
      });

      // Log activity
      await saveActivityLog(taskId, "status_change", previousStatus, newStatus);

      console.log(`Task ${taskId} moved to ${newStatus} and updated in Firestore.`);
    } catch (error) {
      console.error("Error updating task:", error);
      tasks.value[taskIndex] = { ...task, status: previousStatus };
    }
  };

  const updateTaskPriority = async (taskId: string, priority: string | null) => {
    if (!taskId) return;

    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousPriority = task.priority;
    const now = new Date().toISOString();

    tasks.value[taskIndex] = { ...task, priority, updatedAt: now };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        priority: priority,
        updatedAt: now,
      });

      // Log activity
      await saveActivityLog(taskId, "priority_change", previousPriority, priority);

      console.log(`Task ${taskId} priority updated to ${priority}.`);
    } catch (error) {
      console.error("Error updating task priority:", error);
      tasks.value[taskIndex] = { ...task, priority: previousPriority };
      throw error;
    }
  };

  const updateTaskName = async (taskId: string, newName: string) => {
    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousName = task.name;
    const now = new Date().toISOString();

    tasks.value[taskIndex] = { ...task, name: newName, updatedAt: now };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        name: newName,
        updatedAt: now,
      });

      // Log activity
      await saveActivityLog(taskId, "name_change", previousName, newName);

      console.log(`Task ${taskId} renamed to ${newName}.`);
    } catch (error) {
      console.error("Error updating task name:", error);
      tasks.value[taskIndex] = { ...task, name: previousName };
    }
  };

  const updateTaskFavorite = async (taskId: string, isFavorite: boolean) => {
    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousValue = task.isFavorite;
    const now = new Date().toISOString();

    tasks.value[taskIndex] = { ...task, isFavorite, updatedAt: now };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        isFavorite,
        updatedAt: now,
      });

      // Log activity
      await saveActivityLog(taskId, "favorite_change", previousValue, isFavorite);

      console.log(`Task ${taskId} favorite status updated to ${isFavorite}.`);
    } catch (error) {
      console.error("Error updating task favorite status:", error);
      tasks.value[taskIndex] = { ...task, isFavorite: previousValue };
    }
  };

  const deleteTask = async (taskId: string) => {
    const taskToDelete = tasks.value.find((t) => t.id === taskId);

    try {
      const taskRef = doc(db, "tasks", taskId);
      await deleteDoc(taskRef);

      // Log activity before removing from local state
      if (taskToDelete) {
        await saveActivityLog(taskId, "task_deleted", taskToDelete, null);
      }

      tasks.value = tasks.value.filter((task) => task.id !== taskId);
      console.log(`Task ${taskId} deleted successfully.`);
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  };

  const assignUserToTask = async (taskId: string, userId: string) => {
    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousAssignee = task.assignedTo;
    const now = new Date().toISOString();

    tasks.value[taskIndex] = { ...task, assignedTo: userId, updatedAt: now };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        assignedUserId: userId,
        updatedAt: now,
      });

      // Log activity
      await saveActivityLog(taskId, "assignment_change", previousAssignee, userId);

      console.log(`Task ${taskId} assigned to user ${userId}.`);
    } catch (error) {
      console.error("Error assigning user to task:", error);
      tasks.value[taskIndex] = { ...task, assignedTo: previousAssignee };
    }
  };

  const updateTaskAssignment = async (taskId: string, userId: string | null) => {
    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];
    const previousAssignee = task.assignedTo;
    const now = new Date().toISOString();

    tasks.value[taskIndex] = { ...task, assignedTo: userId, updatedAt: now };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        assignedTo: userId,
        updatedAt: now,
      });

      // Log activity
      await saveActivityLog(taskId, "assignment_change", previousAssignee, userId);

      console.log(`Task ${taskId} assignment updated to ${userId || "unassigned"}.`);
    } catch (error) {
      console.error("Error updating task assignment:", error);
      tasks.value[taskIndex] = { ...task, assignedTo: previousAssignee };
      throw error;
    }
  };

  const updateTaskCompletion = async (taskId: string, completion: number) => {
    if (completion < 0 || completion > 100) {
      console.error("Completion percentage must be between 0 and 100");
      return;
    }

    const taskIndex = tasks.value.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      console.error("Task not found:", taskId);
      return;
    }

    const task = tasks.value[taskIndex];

    // If task is in "Completed" status, don't allow changing completion
    if (task.status === "Completed" && completion !== 100) {
      toast.info("Tasks in 'Completed' status are already 100% complete.");
      return;
    }

    const previousCompletion = task.completion;
    const now = new Date().toISOString();

    // If setting to 100%, consider changing status to Completed
    let updatedFields: any = {
      completion: completion,
      updatedAt: now,
    };

    if (completion === 100 && task.status !== "Completed") {
      // Optionally update status to Completed when reaching 100%
      // Uncomment the next line if you want this behavior
      // updatedFields.status = "Completed";
      // updatedFields.statusUpdatedAt = now;
    }

    tasks.value[taskIndex] = {
      ...task,
      ...updatedFields,
    };

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, updatedFields);

      // Log activity
      await saveActivityLog(taskId, "completion_update", previousCompletion, completion);

      console.log(`Task ${taskId} completion updated to ${completion}%`);
    } catch (error) {
      console.error("Error updating task completion:", error);
      toast.error("Failed to update task completion");

      // Restore previous state
      tasks.value[taskIndex] = { ...task };
      throw error;
    }
  };

  return {
    tasks,
    fetchTasksForGroup,
    updateTaskStatus,
    assignUserToTask,
    updateTaskFavorite,
    updateTaskName,
    updateTaskAssignment,
    updateTaskPriority,
    deleteTask,
    updateTaskCompletion,
    saveActivityLog,
  };
});
