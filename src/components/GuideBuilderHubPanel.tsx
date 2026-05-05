import { PageHeader } from "./ui/PageHeader";
import { TeacherGuidancePanel } from "./TeacherGuidancePanel";
import { AgentBuilderPanel } from "./AgentBuilderPanel";
import type { GuideBuilderSection } from "../types";

export function GuideBuilderHubPanel({
  section,
  onSectionChange,
}: {
  section: GuideBuilderSection;
  onSectionChange: (s: GuideBuilderSection) => void;
}) {
  return (
    <div className="panel guide-builder-hub">
      <PageHeader
        title="Guide builder"
        subtitle="Shape the voice and instructions that support you."
      />

      <div className="guide-builder-safety-note" role="note">
        <span aria-hidden="true" />
        <p>
          Prompts are capped on the server; safety rules always apply first. Not medical or crisis advice-reach out to
          trusted humans when you need hands-on help.
        </p>
      </div>

      <div className="guide-builder-subtabs" role="tablist" aria-label="Guide builder sections">
        <button
          type="button"
          role="tab"
          aria-selected={section === "teachers"}
          className={"guide-builder-subtab" + (section === "teachers" ? " guide-builder-subtab--active" : "")}
          onClick={() => onSectionChange("teachers")}
        >
          Teachers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "agents"}
          className={"guide-builder-subtab" + (section === "agents" ? " guide-builder-subtab--active" : "")}
          onClick={() => onSectionChange("agents")}
        >
          Agents
        </button>
      </div>

      <div
        className="guide-builder-hub-panel"
        role="tabpanel"
        aria-label={section === "teachers" ? "Teachers" : "Agents"}
      >
        {section === "teachers" ? <TeacherGuidancePanel embedded /> : <AgentBuilderPanel embedded />}
      </div>
    </div>
  );
}
