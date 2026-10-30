import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sliders,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Shield,
  Clock,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button, Input, Badge, useToast } from '../../components/ui';

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Weights state
  const [wN, setWN] = useState(40);
  const [wD, setWD] = useState(30);
  const [wE, setWE] = useState(20);
  const [wA, setWA] = useState(10);

  // Live sum
  const totalWeight = wN + wD + wE + wA;
  const isValidSum = totalWeight === 100;

  // Simulator inputs
  const [simN, setSimN] = useState(0.8);
  const [simD, setSimD] = useState(1.0);
  const [simE, setSimE] = useState(1.0);
  const [simA, setSimA] = useState(0.5);

  const simulatedScore = wN * simN + wD * simD + wE * simE + wA * simA;

  // Save weights mutation
  const saveWeightsMutation = useMutation({
    mutationFn: () => api.updateFairnessWeights({ wN, wD, wE, wA }),
    onSuccess: () => {
      addToast({
        title: 'Priority Weights Updated!',
        message: 'Algorithmic formula recalculated across all pending reservation queues.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['fairness-profile'] });
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Update Failed',
        message: (err as Error).message || 'Weights must sum exactly to 100.',
        variant: 'danger',
      });
    },
  });

  const resetDemoMutation = useMutation({
    mutationFn: () => api.resetDemoData(),
    onSuccess: (res) => {
      addToast({
        title: 'Demo Environment Reset!',
        message: res.message || 'Factory test records restored. Ready for new evaluation workflow.',
        variant: 'success',
      });
      queryClient.invalidateQueries();
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Reset Failed',
        message: (err as Error).message || 'Failed to reset demo data.',
        variant: 'danger',
      });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Platform Settings & <span className="squiggle-word">Fairness</span> Weights
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Configure institutional access weights, live priority score simulation, and reservation quota limits
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Fairness Weights Form */}
        <div
          style={{
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--ink-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={20} color="var(--persimmon-500)" />
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--ink)' }}>
                Formula Weights ($w_N + w_D + w_E + w_A = 100$)
              </h3>
            </div>
            <Badge variant={isValidSum ? 'fern' : 'cherry'}>
              SUM: {totalWeight}% {isValidSum ? 'VALID' : 'INVALID'}
            </Badge>
          </div>

          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-relaxed)' }}>
            Each component influences student queue standing. Changes are audited and recalculate the decision matrix instantly.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>
                <span>wN: Recent Non-Usage Weight</span>
                <span>{wN}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wN}
                onChange={(e) => setWN(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--persimmon-500)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>
                <span>wD: Academic Need / Keyword Match Weight</span>
                <span>{wD}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wD}
                onChange={(e) => setWD(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--persimmon-500)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>
                <span>wE: Safety Eligibility & Certifications Weight</span>
                <span>{wE}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wE}
                onChange={(e) => setWE(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--persimmon-500)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>
                <span>wA: Waiting Time Weight</span>
                <span>{wA}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wA}
                onChange={(e) => setWA(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--persimmon-500)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <Button
              variant="primary"
              disabled={!isValidSum}
              loading={saveWeightsMutation.isPending}
              onClick={() => saveWeightsMutation.mutate()}
              leftIcon={<Save size={16} />}
              style={{ backgroundColor: 'var(--lilac-500)', borderColor: 'var(--lilac-400)' }}
            >
              Save & Audit Weights
            </Button>
          </div>
        </div>

        {/* Live Simulator Preview */}
        <div
          style={{
            backgroundColor: 'var(--milk)',
            border: '1.5px solid var(--ink-border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--fern-500)" />
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
              Live Score Simulator
            </h3>
          </div>

          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--oat-50)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Computed Priority Score
            </span>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--fern-600)', fontFamily: 'var(--font-mono)' }}>
              {simulatedScore.toFixed(1)} <span style={{ fontSize: 18, color: 'var(--ink-mute)' }}>/ 100</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Non-Usage Factor (N = {simN}):</span>
              <input type="range" min="0" max="1" step="0.1" value={simN} onChange={(e) => setSimN(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--fern-500)' }} />
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Need Match Factor (D = {simD}):</span>
              <input type="range" min="0.2" max="1" step="0.1" value={simD} onChange={(e) => setSimD(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--fern-500)' }} />
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Eligibility Factor (E = {simE}):</span>
              <input type="range" min="0" max="1" step="0.1" value={simE} onChange={(e) => setSimE(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--fern-500)' }} />
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Wait Time Factor (A = {simA}):</span>
              <input type="range" min="0" max="1" step="0.1" value={simA} onChange={(e) => setSimA(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--fern-500)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Judges & Evaluation: Reset Demo Data */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--cherry-300)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <RotateCcw size={20} color="var(--cherry-600)" />
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--cherry-700)' }}>
              Reset Demo Environment (Judges One-Click Retry)
            </h3>
          </div>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
            Restores all dynamic bookings, handover inspection photos, and test incidents back to initial factory state. Fully audited.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm('Reset all demo bookings, handover inspections, and test incidents back to pristine demo state?')) {
              resetDemoMutation.mutate();
            }
          }}
          loading={resetDemoMutation.isPending}
          leftIcon={<RotateCcw size={16} />}
          style={{
            borderColor: 'var(--cherry-400)',
            color: 'var(--cherry-700)',
            whiteSpace: 'nowrap',
          }}
        >
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
};

