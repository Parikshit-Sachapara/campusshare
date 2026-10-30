import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Package,
  Layers,
  Image,
  FileCheck,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Button,
  Input,
  Select,
  Textarea,
  Badge,
  useToast,
} from '../../components/ui';

const resourceSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  category_id: z.string().min(1, 'Please select a category'),
  department_id: z.string().min(1, 'Please select a department'),
  location: z.string().min(2, 'Location is required (e.g. Makerspace Pod B)'),
  resource_type: z.enum(['EQUIPMENT', 'FACILITY']),
  description: z.string().optional(),
  quantity: z.number().min(1),
  capacity: z.number().optional(),
  deposit_amount: z.number(),
  approval_required: z.boolean(),
  training_required: z.boolean(),
  min_duration_minutes: z.number().min(15),
  max_duration_minutes: z.number().min(30),
  advance_booking_days: z.number().min(1),
  primary_image_url: z.string().optional(),
});

type ResourceFormData = z.infer<typeof resourceSchema>;

export const AddEditResourcePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Fetch departments & categories
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.listDepartments() });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.listCategories() });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      name: '',
      category_id: '',
      department_id: '',
      location: '',
      resource_type: 'EQUIPMENT',
      description: '',
      quantity: 1,
      capacity: 10,
      deposit_amount: 0,
      approval_required: false,
      training_required: false,
      min_duration_minutes: 60,
      max_duration_minutes: 240,
      advance_booking_days: 14,
      primary_image_url: '',
    },
  });

  const resourceType = watch('resource_type');
  const watchedValues = watch();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ResourceFormData) => api.createResource(data as unknown as Record<string, unknown>),
    onSuccess: (created) => {
      addToast({
        title: 'Resource Published!',
        message: `${created.name} is now active in the campus catalog.`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      navigate('/resources');
    },
    onError: (err: unknown) => {
      addToast({
        title: 'Failed to Create Resource',
        message: (err as Error).message,
        variant: 'danger',
      });
    },
  });

  const onSubmit = (data: ResourceFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/resources')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-soft)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 'var(--space-2)',
          }}
        >
          <ArrowLeft size={14} /> Back to Assets
        </button>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', color: 'var(--ink)' }}>
          Register New Campus <span className="squiggle-word">Resource</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 'var(--text-sm)' }}>
          Step {currentStep} of 4: {currentStep === 1 ? 'Asset Basics' : currentStep === 2 ? 'Schedule & Rules' : currentStep === 3 ? 'Visual Assets' : 'Audit & Confirm'}
        </p>
      </div>

      {/* Step Indicator Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--space-2)',
        }}
      >
        {[
          { step: 1, label: '1. Basics', icon: <Package size={14} /> },
          { step: 2, label: '2. Rules', icon: <Layers size={14} /> },
          { step: 3, label: '3. Media', icon: <Image size={14} /> },
          { step: 4, label: '4. Review', icon: <FileCheck size={14} /> },
        ].map((s) => (
          <div
            key={s.step}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: currentStep === s.step ? 'var(--persimmon-100)' : 'var(--milk)',
              border: currentStep === s.step ? '1.5px solid var(--persimmon-500)' : '1px solid var(--oat-200)',
              color: currentStep === s.step ? 'var(--persimmon-600)' : 'var(--ink-soft)',
              fontWeight: 600,
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {s.icon}
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Multi-step Form Card */}
      <div
        style={{
          backgroundColor: 'var(--milk)',
          border: '1.5px solid var(--ink-border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-8)',
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* STEP 1: BASICS */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                label="Resource Name"
                placeholder="e.g. Sony FX3 Cinema Kit / Cleanroom Bench 03"
                error={errors.name?.message}
                {...register('name')}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Select
                  label="Category"
                  options={(categories || []).map((c) => ({ label: c.name, value: c.id }))}
                  error={errors.category_id?.message}
                  {...register('category_id')}
                />
                <Select
                  label="Department"
                  options={(departments || []).map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))}
                  error={errors.department_id?.message}
                  {...register('department_id')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Select
                  label="Resource Type"
                  options={[
                    { label: 'EQUIPMENT (Individual physical units)', value: 'EQUIPMENT' },
                    { label: 'FACILITY (Room, studio, or lab bench)', value: 'FACILITY' },
                  ]}
                  {...register('resource_type')}
                />
                <Input
                  label="Location"
                  placeholder="e.g. Turing Hall Rm 302"
                  error={errors.location?.message}
                  {...register('location')}
                />
              </div>

              <Textarea
                label="Description & Intended Scope"
                placeholder="Include specifications, safety notices, and access requirements..."
                error={errors.description?.message}
                {...register('description')}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="primary" onClick={() => setCurrentStep(2)} rightIcon={<ArrowRight size={16} />}>
                  Continue to Rules
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: RULES & DURATION */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {resourceType === 'EQUIPMENT' ? (
                  <Input
                    label="Physical Units / Quantity Available"
                    type="number"
                    error={errors.quantity?.message}
                    {...register('quantity', { valueAsNumber: true })}
                  />
                ) : (
                  <Input
                    label="Facility Room Capacity (Persons)"
                    type="number"
                    error={errors.capacity?.message}
                    {...register('capacity', { valueAsNumber: true })}
                  />
                )}
                <Input
                  label="Advance Booking Window (Days)"
                  type="number"
                  error={errors.advance_booking_days?.message}
                  {...register('advance_booking_days', { valueAsNumber: true })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input
                  label="Min Duration (Minutes)"
                  type="number"
                  error={errors.min_duration_minutes?.message}
                  {...register('min_duration_minutes', { valueAsNumber: true })}
                />
                <Input
                  label="Max Duration (Minutes)"
                  type="number"
                  error={errors.max_duration_minutes?.message}
                  {...register('max_duration_minutes', { valueAsNumber: true })}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'var(--space-2)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
                  <input type="checkbox" {...register('approval_required')} style={{ accentColor: 'var(--persimmon-500)' }} />
                  <span>Manual Staff Approval Required Before Pass Issuance</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--ink)' }}>
                  <input type="checkbox" {...register('training_required')} style={{ accentColor: 'var(--persimmon-500)' }} />
                  <span>Mandatory Safety Certification Required</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)} leftIcon={<ArrowLeft size={16} />}>
                  Back
                </Button>
                <Button type="button" variant="primary" onClick={() => setCurrentStep(3)} rightIcon={<ArrowRight size={16} />}>
                  Continue to Media
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: MEDIA */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input
                label="Primary Image Asset URL"
                placeholder="https://images.unsplash.com/... / asset link"
                error={errors.primary_image_url?.message}
                {...register('primary_image_url')}
              />

              <div
                style={{
                  height: 180,
                  border: '2px dashed var(--oat-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--ink-soft)',
                  fontSize: 'var(--text-xs)',
                  backgroundColor: 'var(--oat-50)',
                }}
              >
                <Image size={28} color="var(--ink-mute)" />
                <span>Upload high-resolution equipment photos or paste public URL above</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)} leftIcon={<ArrowLeft size={16} />}>
                  Back
                </Button>
                <Button type="button" variant="primary" onClick={() => setCurrentStep(4)} rightIcon={<ArrowRight size={16} />}>
                  Review & Publish
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: AUDIT & CONFIRM */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', color: 'var(--ink)' }}>
                Review Asset Profile Before Activation
              </h3>

              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--oat-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--oat-200)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 'var(--text-xs)',
                }}
              >
                <div><strong>Name:</strong> {watchedValues.name}</div>
                <div><strong>Type:</strong> {watchedValues.resource_type} • <strong>Location:</strong> {watchedValues.location}</div>
                <div><strong>Duration:</strong> {watchedValues.min_duration_minutes}m to {watchedValues.max_duration_minutes}m</div>
                <div><strong>Rules:</strong> {watchedValues.approval_required ? 'Approval Required' : 'Instant Booking'}, {watchedValues.training_required ? 'Safety Cert Required' : 'Open Access'}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)' }}>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)} leftIcon={<ArrowLeft size={16} />}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createMutation.isPending}
                  rightIcon={<CheckCircle2 size={16} />}
                  style={{ backgroundColor: 'var(--fern-500)', borderColor: 'var(--fern-600)' }}
                >
                  Activate & Publish to Campus
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
