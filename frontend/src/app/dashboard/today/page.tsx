'use client';

import { useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// -----------------------------
// Initialize Supabase client
// -----------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Task = {
  id: string;
  description: string;
  related_id: string;
  due_at: string;
  status: string;
  type: string;
  tenant_id: string;
};

export default function TodayTasksPage() {
  const queryClient = useQueryClient();

  // -----------------------------
  // Fetch tasks due today
  // -----------------------------
  const fetchTasks = async (): Promise<Task[]> => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('due_at', startOfDay.toISOString())
      .lte('due_at', endOfDay.toISOString())
      .order('due_at', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  // -----------------------------
  // React Query v5 useQuery
  // -----------------------------
  const { data: tasks = [], isLoading, isError, refetch, error } = useQuery<Task[], Error>({
    queryKey: ['todayTasks'],
    queryFn: fetchTasks,
  });

  // -----------------------------
  // Mark task complete
  // -----------------------------
  const markComplete = useCallback(
    async (taskId: string) => {
      // Optimistic UI update
      queryClient.setQueryData<Task[]>({
        queryKey: ['todayTasks'],
        updater: (old) =>
          old?.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)),
      });

      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);

        if (error) throw error;

        // Refetch to sync with server
        refetch();
      } catch (err: any) {
        alert(`Failed to mark task complete: ${err.message}`);
        refetch(); // revert
      }
    },
    [queryClient, refetch]
  );

  // -----------------------------
  // Render loading & error states
  // -----------------------------
  if (isLoading) return <div className="text-center mt-10">Loading today's tasks...</div>;
  if (isError)
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded mt-4">
        <p>Error loading tasks: {error?.message}</p>
        <button onClick={() => refetch()} className="underline mt-2">
          Retry
        </button>
      </div>
    );

  // -----------------------------
  // Render table
  // -----------------------------
  return (
    <div className="max-w-6xl mx-auto p-8 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Today's Agenda</h1>
          <p className="text-gray-500 text-sm mt-1">
            Overview of tasks due on {new Date().toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
        >
          Refresh
        </button>
      </header>

      <div className="bg-white shadow border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                App ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No tasks due today. You're all caught up!
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`transition-colors ${
                    task.status === 'completed' ? 'bg-gray-50 opacity-75' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4">{task.description}</td>
                  <td className="px-6 py-4 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                    {task.related_id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 capitalize">{task.type}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => markComplete(task.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Mark Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
