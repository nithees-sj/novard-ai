import React from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { PageHeader } from '../../components/admin/ui';
import { EmptyState } from '../../components/learning/LearningUI';

/** The admin assistant (built in the next phase). */
export default function Assistant() {
  return (
    <AdminLayout title="ADMIN · ASSISTANT">
      <PageHeader title="Admin assistant" />
      <EmptyState icon="chat" title="Coming soon" text="Ask about risk, reports, costs and gateways in plain words." />
    </AdminLayout>
  );
}
