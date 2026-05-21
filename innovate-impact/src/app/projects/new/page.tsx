import { ProjectIntakeWizard } from "@/components/project-intake-wizard";

export default function NewProjectPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Create a new innovation project</h1>
      <p className="text-slate-400 text-sm mb-6">
        Capture the business problem, target outcomes, audience, and which work products you want generated.
      </p>
      <ProjectIntakeWizard />
    </div>
  );
}
