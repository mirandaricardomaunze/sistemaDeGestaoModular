---
name: responsive-layouts
description: "Padrões técnicos e regras canónicas para layouts responsivos (Mobile/Tablet), alinhamento de filtros e botões de tabelas, comportamento de abas (tabs) e aproveitamento de espaço dentro de Cards no Multicore ERP."
---

# 📱 Layouts Responsivos: Filtros, Tabelas, Abas e Cards

> 🤖 **DIRETRIZ DE APLICAÇÃO OBRIGATÓRIA (IA)**: Todas as modificações ou novos componentes em `frontend/src` devem seguir rigorosamente estes padrões de responsividade para Mobile (viewports `< 640px`) e Tablet (viewports `640px` a `1024px`). Use esta skill sempre que estiver a estruturar vistas com filtros, tabelas, abas ou grelhas de cards.

---

## 1. Responsividade Mobile & Tablet (Mobile-First)

Escreva sempre as classes do Tailwind usando a metodologia **Mobile-First**. As classes base definem o comportamento no ecrã mais pequeno (Mobile portrait, `>= 360px`), e os prefixos (`sm:`, `md:`, `lg:`) aplicam estilos para ecrãs maiores.

* **Mobile portrait (base)**: 360px - 639px (ex: `w-full grid-cols-1`)
* **Tablet / Mobile landscape (`sm:` / `md:`)**: 640px - 1023px (ex: `sm:w-auto md:grid-cols-2`)
* **Laptop / Desktop (`lg:` / `xl:`)**: >= 1024px (ex: `lg:grid-cols-4`)

---

## 2. Organização de Botões, Filtros e Ações de Tabelas

As barras de filtros e botões de ações associados a tabelas tendem a quebrar no mobile. Siga estas regras de estruturação:

### A. Alinhamento de Filtros
* **Mobile**: Todos os inputs (`Input`, `Select`, data picker) e botões de ação devem empilhar verticalmente e ocupar a largura total do ecrã (`w-full flex-col`).
* **Tablet/Desktop**: Alinhamento horizontal com altura consistente (`h-10` ou `h-11`). Use `items-end` no contentor principal para que os elementos alinhem perfeitamente na base caso haja labels.

### B. Barra de Filtros Responsiva Canónica
```tsx
import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { HiOutlineAdjustmentsHorizontal, HiOutlineMagnifyingGlass, HiOutlineArrowPath } from 'react-icons/hi2';

export function TableToolbar() {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="w-full flex flex-col gap-3 bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700 shadow-sm">
      {/* Linha Superior: Pesquisa Rápida e Botão de Filtros em Mobile */}
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <div className="relative flex-1">
          <Input 
            placeholder="Pesquisar..." 
            className="w-full pl-10"
            // Garante tamanho de toque de 44px/48px no mobile
            inputClassName="h-11 lg:h-10"
          />
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Botão para mostrar filtros adicionais no mobile */}
          <Button 
            variant="outline" 
            className="flex-1 sm:hidden h-11"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<HiOutlineAdjustmentsHorizontal />}
          >
            Filtros
          </Button>
          
          <Button variant="primary" className="flex-1 sm:w-auto h-11 lg:h-10">
            PESQUISAR
          </Button>
        </div>
      </div>

      {/* Filtros Secundários: Colapsáveis em Mobile, Visíveis por Padrão em Desktop */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end ${
        showFilters ? 'block' : 'hidden sm:grid'
      }`}>
        <div className="w-full">
          <label className="text-xs text-gray-500 font-medium mb-1 block">Estado</label>
          <Select className="w-full h-11 lg:h-10">
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
        
        <div className="w-full">
          <label className="text-xs text-gray-500 font-medium mb-1 block">Período</label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" className="h-11 lg:h-10" />
            <Input type="date" className="h-11 lg:h-10" />
          </div>
        </div>

        <div className="flex gap-2 sm:col-span-2 md:col-span-1">
          <Button variant="outline" className="flex-grow h-11 lg:h-10" leftIcon={<HiOutlineArrowPath />}>
            LIMPAR
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### C. Botões de Ações de Tabelas (Exportar, Novo, etc.)
* **Mobile**: Botões como "Exportar PDF" ou "Novo Registo" devem ocupar a largura total do ecrã. Se houver mais do que dois botões, agrupe-os ou utilize um botão de menu/dropdown de ações ("Ações") para não poluir o ecrã.
* **Tablet/Desktop**: Devem alinhar-se à direita ou ao lado da barra de pesquisa em linha horizontal (`sm:flex-row sm:w-auto`).

---

## 3. Comportamento e Responsividade de Abas (Tabs)

As abas horizontais de navegação são uma causa comum de transbordo (overflow) horizontal. Utilize o seguinte padrão para garantir que são navegáveis e não partem o ecrã:

```tsx
<div className="w-full overflow-x-auto overscroll-x-contain scrollbar-none pb-1">
  <div className="flex gap-1.5 bg-gray-100/60 dark:bg-dark-900/60 backdrop-blur-sm rounded-xl p-1.5 w-max min-w-max border border-gray-200/50 dark:border-dark-700 shadow-inner">
    {TABS.map((tab) => (
      <Button
        key={tab.id}
        variant={activeTab === tab.id ? 'primary' : 'ghost'}
        className="whitespace-nowrap flex-1 h-10 px-4 text-xs font-bold uppercase tracking-wider"
        onClick={() => setActiveTab(tab.id)}
      >
        {tab.label}
      </Button>
    ))}
  </div>
</div>
```

### Regras das Abas:
1. **`whitespace-nowrap`**: Impede que a etiqueta (label) da aba quebre a linha, mantendo o botão visualmente estático.
2. **`scrollbar-none`**: Oculta a barra de scroll padrão do browser para um visual premium (garantindo que o utilizador pode fazer scroll por arrastamento no mobile).
3. **`w-max` e `min-w-max`**: Garante que o contentor interno de abas flexíveis mantenha a sua largura máxima, prevenindo o esmagamento das abas em ecrãs pequenos.

---

## 4. Cards e Ocupação Total do Espaço Disponível

Os `Cards` são os blocos construtores das vistas. Devem adaptar-se perfeitamente aos seus contentores e preencher o espaço de forma lógica:

### A. Ocupação Horizontal (Largura)
* **Padrão**: Todos os cards devem ocupar `w-full` (100% da largura do seu contentor pai).
* **Prevenção de Estiramento Excessivo**: Em ecrãs largos, utilize limites máximos de largura apenas se o card contiver formulários estreitos (ex: `max-w-2xl mx-auto`).
* **Flexbox/Grid Child**: Quando dentro de um flexbox ou grid, o card deve utilizar `min-w-0` para evitar que elementos internos (como tabelas ou textos longos) forcem o card a alargar e a transbordar da página.

### B. Ocupação Vertical (Altura)
* **Preenchimento de Altura Simétrica**: Para manter o alinhamento visual de colunas, utilize `h-full` no card e configure-o como um contentor flex vertical (`flex flex-col`):
  ```tsx
  <Card className="h-full flex flex-col justify-between">
    <div className="flex-1 w-full">
      {/* Conteúdo principal que cresce e ocupa todo o espaço do card */}
    </div>
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
      {/* Footer/Ações fixos na base do card */}
    </div>
  </Card>
  ```
* **Grelha de Cards Símétrica**: Em dashboards, combine `grid` com `items-stretch` (padrão do grid) e `h-full` nos cards para que todos os cards da mesma linha tenham exactamente a mesma altura.

### C. Espaçamento Interno (Padding) do Card
* **Mobile**: Reduza o padding interno para `p-4` (16px) para maximizar o espaço útil de ecrã.
* **Tablet/Desktop**: Aumente para `p-6` (24px) ou `p-8` (32px) para dar "respiro" ao design.
  ```tsx
  className="p-4 sm:p-6"
  ```

---

## 5. Textos e Tipografia Responsiva

A escala tipográfica deve adaptar-se dinamicamente ao tamanho do ecrã para evitar que textos longos causem quebras ou sobreposições visuais.

### A. Escala Tipográfica Dinâmica
Use tamanhos de texto proporcionais que aumentam à medida que o ecrã cresce:

| Elemento | Mobile | Tablet / Desktop | Classes Tailwind |
| :--- | :--- | :--- | :--- |
| **Título da Página (H1)** | 20px / `text-xl` | 24px / `text-2xl` | `text-xl lg:text-2xl font-bold` |
| **Título do Card/Secção (H2)** | 16px / `text-base` | 18px / `text-lg` | `text-base lg:text-lg font-semibold` |
| **Texto de Corpo** | 14px / `text-sm` | 15px/16px / `text-base` | `text-sm lg:text-base text-gray-600` |
| **Legendas e Labels** | 12px / `text-xs` | 12px / `text-xs` | `text-xs text-gray-500` |
| **Valores de KPIs/Métricas** | 24px / `text-2xl` | 30px / `text-3xl` | `text-2xl lg:text-3xl font-black` |

> [!TIP]
> Para valores monetários e métricas financeiras críticas em dashboards, utilize sempre o componente `<ResponsiveValue>` (localizado em `frontend/src/components/ui/ResponsiveValue.tsx`), que já implementa este comportamento de escala automática.

### B. Tratamento de Textos Longos e Transbordo
Para evitar que e-mails, códigos longos, nomes de produtos ou IDs deformem a interface em ecrãs estreitos, utilize as seguintes classes utilitárias de texto:

1. **`truncate`**: Use para uma única linha que deve terminar em reticências (`...`) caso ultrapasse o limite horizontal.
   ```tsx
   <p className="text-sm font-medium text-gray-900 truncate" title={product.name}>
     {product.name}
   </p>
   ```
2. **`line-clamp-2`** (ou `line-clamp-3`): Use quando o texto pode ter mais de uma linha, mas deve ser cortado com reticências após um número máximo de linhas.
   ```tsx
   <p className="text-xs text-gray-500 line-clamp-2">
     {product.description}
   </p>
   ```
3. **`break-words`** ou **`break-all`**: Use para textos contínuos sem espaços (ex: chaves UUID, tokens, hashes ou caminhos de ficheiros) para forçar a quebra no limite do card.
   ```tsx
   <span className="text-xs font-mono break-all text-gray-400">
     {invoice.id}
   </span>
   ```

### C. Textos Adaptativos / Rótulos Condicionais
Em ecrãs pequenos (Mobile), o espaço horizontal é valioso. Podemos ocultar partes do texto ou alternar entre termos longos e abreviaturas de acordo com o breakpoint:

1. **Mostrar Ícones + Texto no Desktop, Apenas Ícone no Mobile**:
   ```tsx
   <Button variant="outline" className="h-10">
     <HiOutlineArrowDownTray className="w-4 h-4" />
     <span className="hidden sm:inline ml-2">EXPORTAR</span>
   </Button>
   ```
2. **Substituição de Texto por Abreviatura**:
   ```tsx
   <span>
     {/* Visível em Desktop */}
     <span className="hidden md:inline">Número Único de Identificação Tributária</span>
     {/* Visível em Tablet */}
     <span className="hidden sm:inline md:hidden">N.U.I.T.</span>
     {/* Visível em Mobile */}
     <span className="inline sm:hidden">NUIT</span>
   </span>
   ```

---

## 6. Checklist de Verificação de Layouts Responsivos

Antes de submeter alterações de UI ou considerar uma página concluída, verifique:

1. [ ] **Nenhum Scroll Horizontal Indesejado**: A página não tem scroll horizontal a `360px`, `412px`, ou `768px`.
2. [ ] **Inputs e Botões com w-full em Mobile**: Todos os botões e inputs de formulários ocupam toda a largura do seu contentor no mobile, transitando para `sm:w-auto` no tablet.
3. [ ] **Abas sem Esmagamento**: As abas estão dentro de um contentor scrollable horizontal invisível (`overflow-x-auto scrollbar-none whitespace-nowrap`).
4. [ ] **Cards Alinhados em Altura**: Os cards numa grelha de dashboard utilizam `h-full flex flex-col` para garantir o mesmo tamanho e baseline.
5. [ ] **Botões Grandes para Toque**: Botões e inputs operacionais têm pelo menos `44px` ou `48px` de altura no mobile (`h-11` ou `h-12`).
6. [ ] **Utilização de min-w-0**: Elementos flex que contêm texto ou tabelas utilizam `min-w-0` para prevenir transbordo em ecrãs de telemóveis.
7. [ ] **Tipografia Adaptativa**: Os tamanhos dos textos escalam corretamente em mobile e usam utilitários de truncamento/quebra (`truncate`, `break-all`, `line-clamp`) nos dados dinâmicos.
8. [ ] **Rótulos Condicionais**: Textos longos em botões de ação são omitidos (`hidden sm:inline`) ou abreviados no mobile para economizar espaço horizontal.
