import { MembersHeader } from '@/maisvencedores/components/members/MembersHeader';
import { TrainingCard } from '@/maisvencedores/components/members/TrainingCard';
import { mockTrainings } from '@/maisvencedores/data/mockMembers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MembersTraining() {
  const categories = ['todos', 'networking', 'vendas', 'marketing', 'financeiro', 'lideranca'];
  
  return (
    <div className="min-h-screen">
      <MembersHeader 
        title="Treinamentos"
        subtitle="Desenvolva suas habilidades de negócio"
      />
      <div className="p-6">
        <Tabs defaultValue="todos">
          <TabsList className="mb-6 bg-card/50">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="capitalize">
                {cat === 'todos' ? 'Todos' : cat}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockTrainings
                  .filter(t => cat === 'todos' || t.categoryId === cat)
                  .map(training => (
                    <TrainingCard key={training.id} training={training} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
