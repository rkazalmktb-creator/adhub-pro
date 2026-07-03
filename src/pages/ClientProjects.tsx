import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Plus, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, Link } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";

const ClientProjects = () => {
  const navigate = useNavigate();
  const { clientId } = useParams();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, supervising_engineer:engineers!projects_supervising_engineer_id_fkey(id, name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch financial summaries for all projects
  const { data: projectSummaries = {} } = useQuery({
    queryKey: ["client-projects-summaries", clientId],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      
      const projectIds = projects.map(p => p.id);
      const summaries: Record<string, { purchases: number; expenses: number; rentals: number; custody: number }> = {};
      
      // Initialize summaries
      projectIds.forEach(id => {
        summaries[id] = { purchases: 0, expenses: 0, rentals: 0, custody: 0 };
      });
      
      // Get purchases
      const { data: purchases } = await supabase
        .from("purchases")
        .select("project_id, total_amount")
        .in("project_id", projectIds);
      
      purchases?.forEach(p => {
        if (p.project_id && summaries[p.project_id]) {
          summaries[p.project_id].purchases += Number(p.total_amount || 0);
        }
      });
      
      // Get expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("project_id, amount")
        .in("project_id", projectIds);
      
      expenses?.forEach(e => {
        if (e.project_id && summaries[e.project_id]) {
          summaries[e.project_id].expenses += Number(e.amount || 0);
        }
      });
      
      // Get rentals
      const { data: rentals } = await supabase
        .from("equipment_rentals")
        .select("project_id, total_amount")
        .in("project_id", projectIds);
      
      rentals?.forEach(r => {
        if (r.project_id && summaries[r.project_id]) {
          summaries[r.project_id].rentals += Number(r.total_amount || 0);
        }
      });
      
      // Get custody
      const { data: custody } = await supabase
        .from("project_custody")
        .select("project_id, amount")
        .in("project_id", projectIds);
      
      custody?.forEach(c => {
        if (c.project_id && summaries[c.project_id]) {
          summaries[c.project_id].custody += Number(c.amount || 0);
        }
      });
      
      return summaries;
    },
    enabled: !!projects && projects.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects" className="hover:text-primary">
          المشاريع
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{client?.name || "العميل"}</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">مشاريع {client?.name}</h1>
          <p className="text-muted-foreground">إدارة مشاريع العميل</p>
        </div>
        <Button className="gap-2" onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
          <Plus className="h-5 w-5" />
          مشروع جديد
        </Button>
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const summary = projectSummaries[project.id] || { purchases: 0, expenses: 0, rentals: 0, custody: 0 };
            return (
              <ProjectCard 
                key={project.id}
                id={project.id}
                name={project.name}
                progress={project.progress}
                status={project.status as "active" | "pending" | "completed" | "cancelled"}
                budget={formatCurrencyLYD(project.budget)}
                spent={formatCurrencyLYD(project.spent)}
                supervisingEngineerName={project.supervising_engineer?.name}
                imageUrl={(project as any).image_url}
                purchasesTotal={summary.purchases}
                expensesTotal={summary.expenses}
                rentalsTotal={summary.rentals}
                custodyTotal={summary.custody}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground mb-4">لا توجد مشاريع لهذا العميل</p>
          <Button onClick={() => navigate(`/projects/new?client_id=${clientId}&returnTo=/projects/client/${clientId}`)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة مشروع جديد
          </Button>
        </div>
      )}
    </div>
  );
};

export default ClientProjects;
