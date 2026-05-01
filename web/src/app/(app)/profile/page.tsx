'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { apiFetch } from '../../../lib/api';

type Member = {
  _id: string;
  fullName: string;
  relationship?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'patient') return;
    router.push('/settings');
  }, [router, user]);

  useEffect(() => {
    const load = async () => {
      if (!user || user.role !== 'patient') return;
      setLoading(true);
      try {
        const m = await apiFetch<Member[]>('/patients/my');
        const list = m || [];
        setMembers(list);

        const storageKey = `activeMemberId:${user.id}`;
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const next = stored && list.some((x) => x._id === stored) ? stored : list[0]?._id || '';
        setActiveMemberId(next);
        if (next && typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, next);
        }
      } catch {
        setMembers([]);
        setActiveMemberId('');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user]);

  const activeMember = useMemo(() => {
    if (!activeMemberId) return null;
    return members.find((m) => m._id === activeMemberId) || null;
  }, [activeMemberId, members]);

  if (!user) return null;
  if (user.role !== 'patient') return null;

  return (
    <div className="-mx-6 md:-mx-8 bg-[#F9FAFB] min-h-[calc(100vh-var(--shell-top-offset))] pb-28">
      <div className="bg-white px-6 md:px-8 pt-8 pb-8 rounded-b-[2.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-6 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-[#0254b7] tracking-widest uppercase">My Profile</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Patient</div>
            <div className="mt-1 text-sm font-medium text-gray-500">+91 {user.mobile}</div>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0254b7] to-indigo-600 flex items-center justify-center text-white font-bold shadow-inner">
            {(activeMember?.fullName?.trim?.()?.[0] || 'P').toUpperCase()}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 md:px-8 space-y-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Active member</div>
              <div className="mt-1 text-sm font-medium text-gray-500">
                {loading ? 'Loading…' : activeMember?.fullName || (members.length === 0 ? 'No members' : 'Select member')}
              </div>
            </div>
            <Link
              href="/patients"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-[#0254b7] text-white font-bold text-sm shadow-md hover:bg-blue-700 active:scale-95 transition-all"
            >
              Manage
            </Link>
          </div>

          {members.length > 0 ? (
            <div className="mt-4 flex overflow-x-auto gap-2 pb-1 hide-scrollbar [&::-webkit-scrollbar]:hidden">
              {members.map((m) => {
                const active = m._id === activeMemberId;
                return (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => {
                      setActiveMemberId(m._id);
                      const storageKey = `activeMemberId:${user.id}`;
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem(storageKey, m._id);
                      }
                    }}
                    className={`flex-shrink-0 inline-flex items-center justify-center px-4 h-9 rounded-full text-xs font-bold transition-all ${active
                      ? 'bg-[#0254b7] text-white shadow-md shadow-blue-500/20'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                      }`}
                  >
                    {m.fullName}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/health-records"
            className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-blue-100 hover:shadow-md active:scale-[0.97] transition-all"
          >
            <div className="w-12 h-12 rounded-[1rem] bg-blue-50 flex items-center justify-center text-[#0254b7]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8" />
                <path d="M8 17h8" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">Health Records</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">View & download</div>
            </div>
          </Link>

          <Link
            href="/appointments"
            className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 hover:border-indigo-100 hover:shadow-md active:scale-[0.97] transition-all"
          >
            <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 flex items-center justify-center text-indigo-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v3" />
                <path d="M16 2v3" />
                <path d="M3 9h18" />
                <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">Appointments</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">Upcoming & past</div>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-5 shadow-sm">
          <div className="text-sm font-bold text-gray-900">Account</div>
          <div className="mt-2 text-sm font-medium text-gray-500">Signed in with +91 {user.mobile}</div>

          <button
            type="button"
            onClick={() => logout()}
            className="mt-5 w-full rounded-2xl bg-red-50 border border-red-100 py-3 text-sm font-bold text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
