import React, { createContext, useContext, ReactNode } from 'react';
import { Faixa, faixaAlcanca } from '@/maisvencedores/types/member';
import { useProfile } from '@/maisvencedores/hooks/useProfile';

interface MembershipContextType {
  currentMember: ReturnType<typeof useProfile>['profile'];
  faixa: Faixa;
  isOnboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
  /** A faixa da pessoa alcança a mínima exigida? */
  alcanca: (faixaMinima: Faixa) => boolean;
  updateMember: ReturnType<typeof useProfile>['updateProfile'];
  isLoading: boolean;
  refetch: () => void;
}

const MembershipContext = createContext<MembershipContextType | undefined>(undefined);

/**
 * A faixa da pessoa logada.
 *
 * Antes isto era `membershipPlan` + um `planHierarchy` local mapeando bronze/prata/ouro pra
 * 1/2/3. Não existe mais hierarquia declarada aqui: a ordem do array FAIXAS em member.ts já é
 * a progressão, e é a mesma ordem do enum no banco. Um lugar só define a ordem.
 */
export function MembershipProvider({ children }: { children: ReactNode }) {
  const { profile, loading: isLoading, updateProfile, refetch } = useProfile();

  // Quem não tem faixa ainda é branca: acabou de se inscrever e não avançou.
  const faixa: Faixa = (profile?.faixa as Faixa) || 'branco';
  const isOnboardingComplete = profile?.onboarding_completed ?? false;

  const alcanca = (faixaMinima: Faixa): boolean => faixaAlcanca(faixa, faixaMinima);

  const setOnboardingComplete = async (complete: boolean) => {
    await updateProfile({ onboarding_completed: complete });
  };

  return (
    <MembershipContext.Provider
      value={{
        currentMember: profile,
        faixa,
        isOnboardingComplete,
        setOnboardingComplete,
        alcanca,
        updateMember: updateProfile,
        isLoading,
        refetch,
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error('useMembership must be used within a MembershipProvider');
  }
  return context;
}
