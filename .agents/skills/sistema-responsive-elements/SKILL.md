---
name: sistema-responsive-elements
description: "Canonical layout patterns for inputs, selects, dropdowns, buttons, and tab controls to ensure mobile-first responsive excellence in Multicore ERP."
---

# Responsividade de Elementos UI — Multicore ERP

Este guia estabelece os padrões técnicos que todos os engenheiros e agentes de IA devem seguir para assegurar que formulários, abas de navegação e botões em cards sejam 100% responsivos e não quebrem ou transbordem (overflow) no mobile (`viewport < 640px`).

---

## 1. Abas e Controles Segmentados (Tabs / Segmented Controls)

A maior causa de quebra horizontal de páginas (scroll indesejado) é o transbordo de listas de abas horizontais.

### O Padrão Canónico
Todas as abas que possam ultrapassar a largura do ecrã em mobile devem ser envoltas num contentor com scroll horizontal invisível e independente:

```tsx
<div className="w-full overflow-x-auto overscroll-x-contain scrollbar-none pb-1">
    <div className="flex gap-1 bg-gray-100/50 dark:bg-dark-800/50 backdrop-blur-sm rounded-xl p-1.5 w-max border border-gray-200 dark:border-dark-700 shadow-sm">
        {TABS.map(tab => (
            <Button
                key={tab.id}
                className="whitespace-nowrap flex-1"
                // ...
            >
                {tab.label}
            </Button>
        ))}
    </div>
</div>
```

### Regras de Ouro para Abas
* **`scrollbar-none`**: Sempre ocultar a barra de scroll padrão do browser em mobile para um aspeto *premium*.
* **`w-max` ou `min-w-max`**: Definir o container interno flexível como `w-max` para evitar o esmagamento das abas.
* **`whitespace-nowrap`**: Aplicar aos botões de abas para impedir quebras de linha nas labels.

---

## 2. Formulários, Inputs e Selects em Cards

Inputs e dropdowns selects devem adaptar-se dinamicamente ao espaço horizontal do card.

### Regras de Ouro para Formulários
* **Evitar Larguras Fixas (`w-36`, `w-44` etc.) no Mobile**: Campos devem ocupar `w-full` por defeito no mobile. Utilize o prefixo `lg:w-48` para restringir a largura apenas no desktop.
* **Agrupamento de Datas (Início e Fim)**: Para poupar espaço vertical, as duas datas de um filtro devem ficar lado a lado no mobile usando um sub-grid de 2 colunas:
  ```tsx
  <div className="w-full grid grid-cols-2 gap-2 lg:flex lg:w-auto">
      <Input type="date" className="w-full lg:w-36" />
      <Input type="date" className="w-full lg:w-36" />
  </div>
  ```
* **Layout Principal**: Use grelhas fluidas que empilham no mobile e se alinham em grelha no desktop:
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-4 items-end">
  ```

---

## 3. Botões e Ações de Card no Mobile

* **Botões de Formulário/Rodapé**: No mobile, devem ocupar a largura total do seu contentor (`w-full sm:w-auto`).
* **Área de Toque Mínima**: Garanta pelo menos `44px` (`h-11`) ou `48px` (`h-12`) no mobile.
* **Grupo de Ações Secundárias (ex: Atualizar + Exportar)**: Use alinhamento responsivo para botões de rodapé:
  ```tsx
  <div className="flex flex-col sm:flex-row gap-2 [&>*]:w-full sm:[&>*]:w-auto">
  ```

### Proibição de Alturas Fixas (Hardcoded) em Botões e Inputs
* **Nunca use `h-10` ou `h-11` manual:** Os componentes de UI do Multicore (`Button`, `Input`, `Select`) possuem a propriedade genérica `size` (ex: `size="sm"`) que já incorpora toda a lógica de adaptação e toque responsivo entre plataformas (mobile 44px vs desktop 40px).
* **Consequência:** A injecção de alturas fixas através de Tailwind (como `h-11 sm:h-10`) na `className` quebra a consistência do sistema de Design e o alinhamento com campos adjacentes. Use **apenas** `size="sm"` (ou a ausência deste para tamanho padrão).

### Grelhas Expansíveis de Ação (Header Actions)
* **Preenchimento do Espaço:** Contentores de botões no cabeçalho das páginas (ao lado de títulos) devem ocupar o espaço horizontal livre para evitar agrupamentos espremidos.
* Utilize grelhas fluidas com `flex-1` ou definições de `grid-cols` onde o botão tem sempre `w-full` dentro da sua célula:
  ```tsx
  <div className="grid w-full md:w-auto md:flex-1 max-w-[600px] grid-cols-2 sm:grid-cols-3 gap-2 ...">
      <Button className="w-full" size="sm">Actualizar</Button>
      <Button className="w-full" size="sm">Relatório</Button>
      <Button className="w-full col-span-2 sm:col-span-1" size="sm">Novo</Button>
  </div>
  ```
