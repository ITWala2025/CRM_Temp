import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../config/supabase';
import { useToast } from '../ui/ToastProvider';
import { clientConfig } from '../../config/client.config';
import { ShieldCheck, Database, ArrowRight, Lock, Mail, Sparkles } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState('admin@enterprise-crm.internal');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      // Mock Mode instant authentication
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        showSuccess('Welcome to CRM Template', 'Logged in successfully under Mock Mode');
        navigate('/crm', { replace: true });
      }, 400);
      return;
    }

    if (!email || !password) {
      showError('Validation Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        showError('Login Failed', error.message);
      } else {
        showSuccess('Login Successful', 'Redirecting to CRM dashboard...');
        setTimeout(() => {
          navigate('/crm', { replace: true });
        }, 400);
      }
    } catch {
      showError('Login Failed', 'An unexpected error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    showSuccess('Demo Access Granted', 'Accessing CRM with full administrative privileges');
    navigate('/crm', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
          {clientConfig.clientName}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {clientConfig.tagline}
        </p>

        {/* Storage status badge */}
        <div className="mt-4 flex items-center justify-center">
          {isSupabaseConfigured ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Database className="w-3.5 h-3.5 mr-1.5" />
              Connected to Supabase PostgreSQL
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Template Mode: Mock Storage Active (LocalStorage Synced)
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@enterprise-crm.internal"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to CRM</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>

          {!isSupabaseConfigured && (
            <div className="mt-6 pt-6 border-t border-slate-700/80">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full flex items-center justify-center py-2 px-4 rounded-lg text-xs font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                One-Click Quick Access (Mock Admin)
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                To connect to live Supabase, configure <code className="text-indigo-300">VITE_SUPABASE_URL</code> in <code className="text-indigo-300">.env</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

