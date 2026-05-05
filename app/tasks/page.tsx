"use client";

import React, { useState, useEffect } from "react";
// Adjust the import path below to match where your Supabase client is initialized
import { supabase } from "@/lib/supabase"; 
import { Plus, CheckCircle2, Circle, Clock, Briefcase, Trash2, X } from "lucide-react";

interface Job {
  id: string;
  job_number: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed";
  job_id: string | null;
  due_date: string | null;
  jobs?: {
    job_number: string;
    title: string;
  };
}

export default function DailyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch active jobs for the dropdown
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("id, job_number, title")
      .order("created_at", { ascending: false });
    
    if (jobsData) setJobsList(jobsData);

    // Fetch all tasks with linked job details
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*, jobs(job_number, title)")
      .order("created_at", { ascending: false });

    if (tasksData) setTasks(tasksData as Task[]);
    setLoading(false);
  };

  const handleSaveNewTask = async () => {
    if (!newTaskTitle.trim()) return;

    const newTask = {
      title: newTaskTitle,
      description: newTaskDescription,
      job_id: selectedJobId || null,
      status: "todo",
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert([newTask])
      .select("*, jobs(job_number, title)")
      .single();

    if (!error && data) {
      setTasks([data as Task, ...tasks]);
      setIsModalOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setSelectedJobId("");
    } else {
      console.error("Error saving task:", error);
      alert("Failed to save task.");
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (!error) {
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this task?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    
    if (!error) {
      setTasks(tasks.filter(t => t.id !== taskId));
    }
  };

  const renderTaskCard = (task: Task) => (
    <div key={task.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 shadow-lg flex flex-col gap-3 transition-all hover:border-gray-500">
      <div className="flex justify-between items-start">
        <h3 className="text-white font-semibold text-lg leading-tight">{task.title}</h3>
        <button onClick={() => handleDeleteTask(task.id)} className="text-gray-500 hover:text-red-500 transition-colors">
          <Trash2 size={18} />
        </button>
      </div>
      
      {task.description && (
        <p className="text-gray-400 text-sm">{task.description}</p>
      )}

      {task.jobs && (
        <div className="flex items-center gap-2 mt-1">
          <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
            <Briefcase size={12} />
            {task.jobs.job_number} - {task.jobs.title}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 border-t border-[#333] pt-4">
        {task.status !== 'todo' && (
          <button 
            onClick={() => handleUpdateTaskStatus(task.id, 'todo')}
            className="flex-1 bg-[#222] hover:bg-[#333] text-gray-300 text-xs py-2 rounded-lg transition-colors flex justify-center items-center gap-1.5"
          >
            <Circle size={14} /> Reset
          </button>
        )}
        {task.status !== 'in_progress' && (
          <button 
            onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
            className="flex-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 text-xs py-2 rounded-lg transition-colors flex justify-center items-center gap-1.5"
          >
            <Clock size={14} /> Start
          </button>
        )}
        {task.status !== 'completed' && (
          <button 
            onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
            className="flex-1 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 text-xs py-2 rounded-lg transition-colors flex justify-center items-center gap-1.5"
          >
            <CheckCircle2 size={14} /> Complete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Daily Operations</h1>
            <p className="text-gray-400 mt-1">Manage your production workflow and daily tasks.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-xl"
          >
            <Plus size={20} />
            Add New Task
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Loading workflow...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* TODO COLUMN */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <Circle size={18} className="text-gray-500" />
                  To Do
                </h2>
                <span className="bg-[#222] text-gray-400 text-xs py-0.5 px-2.5 rounded-full font-medium">
                  {tasks.filter(t => t.status === "todo").length}
                </span>
              </div>
              {tasks.filter(t => t.status === "todo").map(renderTaskCard)}
            </div>

            {/* IN PROGRESS COLUMN */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  In Progress
                </h2>
                <span className="bg-blue-900/30 text-blue-400 text-xs py-0.5 px-2.5 rounded-full font-medium">
                  {tasks.filter(t => t.status === "in_progress").length}
                </span>
              </div>
              {tasks.filter(t => t.status === "in_progress").map(renderTaskCard)}
            </div>

            {/* COMPLETED COLUMN */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  Completed
                </h2>
                <span className="bg-emerald-900/30 text-emerald-400 text-xs py-0.5 px-2.5 rounded-full font-medium">
                  {tasks.filter(t => t.status === "completed").length}
                </span>
              </div>
              {tasks.filter(t => t.status === "completed").map(renderTaskCard)}
            </div>

          </div>
        )}

        {/* ADD TASK MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111] border border-[#333] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Create New Task</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Task Title</label>
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Prep files for embroidery"
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Description (Optional)</label>
                  <textarea 
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Add details, specific quantities, or notes..."
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Link to Job (Optional)</label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#333] text-white rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none"
                  >
                    <option value="">-- No Job Link --</option>
                    {jobsList.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.job_number} - {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-[#222] hover:bg-[#333] text-white font-medium py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveNewTask}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg transition-colors"
                  >
                    Save Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
