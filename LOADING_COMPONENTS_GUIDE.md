# 🎨 Guia de Componentes de Loading e Feedback

Este guia mostra como usar os novos componentes de loading states e feedback visual.

## 📦 Componentes Disponíveis

### 1. **Skeleton Loaders**

Efeito shimmer para indicar carregamento de conteúdo.

```tsx
import { Skeleton, SkeletonText, SkeletonCard, SkeletonTable } from '../components/ui';

// Skeleton básico
<Skeleton className="w-full h-12" />

// Skeleton circular (avatar)
<Skeleton variant="circular" width={48} height={48} />

// Skeleton de texto (múltiplas linhas)
<SkeletonText lines={3} />

// Skeleton de card completo
<SkeletonCard />

// Skeleton de tabela
<SkeletonTable rows={5} columns={4} />
```

**Exemplo em uma página:**

```tsx
function ProductList() {
    const { products, isLoading } = useProducts();

    if (isLoading) {
        return (
            <div className="space-y-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return <div>{/* Conteúdo real */}</div>;
}
```

---

### 2. **Spinners**

Indicadores de carregamento animados.

```tsx
import { Spinner, LoadingOverlay, LoadingDots } from '../components/ui';

// Spinner simples
<Spinner size="md" variant="primary" />

// Tamanhos: sm, md, lg, xl
<Spinner size="xl" />

// Variantes: primary, white, gray
<Spinner variant="white" />

// Loading overlay (tela inteira ou relativo)
<LoadingOverlay message="Carregando dados..." fullScreen />

// Loading dots (para botões)
<Button disabled>
    Salvando <LoadingDots />
</Button>
```

**Exemplo em um botão:**

```tsx
<Button onClick={handleSubmit} disabled={isSubmitting}>
    {isSubmitting ? (
        <>
            <Spinner size="sm" variant="white" className="mr-2" />
            Salvando...
        </>
    ) : (
        'Salvar'
    )}
</Button>
```

---

### 3. **Progress Bar**

Barra de progresso para operações longas.

```tsx
import { ProgressBar } from '../components/ui';

// Progress bar básica
<ProgressBar progress={75} />

// Com label de porcentagem
<ProgressBar progress={50} showLabel />

// Variantes: primary, success, warning, danger
<ProgressBar progress={90} variant="success" />

// Tamanhos: sm, md, lg
<ProgressBar progress={60} size="lg" />
```

**Exemplo de upload:**

```tsx
function FileUpload() {
    const [progress, setProgress] = useState(0);

    return (
        <div className="space-y-2">
            <p className="text-sm text-gray-600">Fazendo upload...</p>
            <ProgressBar 
                progress={progress} 
                variant="primary" 
                showLabel 
            />
        </div>
    );
}
```

---

### 4. **Empty States**

Estados vazios bonitos e informativos.

```tsx
import { 
    EmptyState, 
    NoDataFound, 
    NoResultsFound, 
    ErrorState, 
    ComingSoon, 
    NoItems 
} from '../components/ui';

// Empty state customizado
<EmptyState
    icon={<HiOutlineInbox className="w-16 h-16" />}
    title="Nenhum produto"
    description="Adicione seu primeiro produto para começar"
    action={{
        label: "Adicionar Produto",
        onClick: () => setShowModal(true),
        icon: <HiOutlinePlus className="w-5 h-5" />
    }}
/>

// Pré-configurados:

// Sem dados
<NoDataFound onAction={() => refetch()} />

// Sem resultados de busca
<NoResultsFound onAction={() => clearFilters()} />

// Erro
<ErrorState onAction={() => retry()} />

// Em breve
<ComingSoon />

// Sem itens específicos
<NoItems 
    itemName="produto" 
    itemNamePlural="produtos"
    onAction={() => setShowModal(true)}
/>
```

**Exemplo em uma lista:**

```tsx
function ProductList() {
    const { products, isLoading, error } = useProducts();

    if (isLoading) return <SkeletonTable />;
    if (error) return <ErrorState onAction={() => refetch()} />;
    if (products.length === 0) {
        return (
            <NoItems
                itemName="produto"
                onAction={() => setShowAddModal(true)}
            />
        );
    }

    return <Table data={products} />;
}
```

---

## 🎯 Padrões Recomendados

### **Padrão 1: Lista com Loading**

```tsx
function CustomerList() {
    const { customers, isLoading, error, refetch } = useCustomers();
    const [search, setSearch] = useState('');

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    // 1. Loading State
    if (isLoading) {
        return (
            <Card>
                <SkeletonTable rows={10} columns={5} />
            </Card>
        );
    }

    // 2. Error State
    if (error) {
        return (
            <Card>
                <ErrorState 
                    onAction={refetch}
                    actionLabel="Tentar Novamente"
                />
            </Card>
        );
    }

    // 3. Empty State (sem dados)
    if (customers.length === 0) {
        return (
            <Card>
                <NoItems
                    itemName="cliente"
                    onAction={() => setShowAddModal(true)}
                />
            </Card>
        );
    }

    // 4. No Results (com filtro)
    if (filteredCustomers.length === 0) {
        return (
            <Card>
                <NoResultsFound 
                    onAction={() => setSearch('')}
                    actionLabel="Limpar Busca"
                />
            </Card>
        );
    }

    // 5. Dados normais
    return (
        <Card>
            <Table data={filteredCustomers} />
        </Card>
    );
}
```

---

### **Padrão 2: Formulário com Submit**

```tsx
function ProductForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (data) => {
        setIsSubmitting(true);
        try {
            await api.createProduct(data);
            toast.success('Produto criado!');
        } catch (error) {
            toast.error('Erro ao criar produto');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Campos do formulário */}
            
            <div className="flex gap-3">
                <Button type="button" variant="ghost">
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Spinner size="sm" variant="white" className="mr-2" />
                            Salvando...
                        </>
                    ) : (
                        'Salvar'
                    )}
                </Button>
            </div>
        </form>
    );
}
```

---

### **Padrão 3: Dashboard com Métricas**

```tsx
function Dashboard() {
    const { metrics, isLoading } = useDashboard();

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-4 gap-4">
            {/* Cards de métricas */}
        </div>
    );
}
```

---

### **Padrão 4: Operação Longa com Progress**

```tsx
function BulkImport() {
    const [progress, setProgress] = useState(0);
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async (file) => {
        setIsImporting(true);
        setProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            await api.importProducts(formData, {
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setProgress(percentCompleted);
                }
            });

            toast.success('Importação concluída!');
        } catch (error) {
            toast.error('Erro na importação');
        } finally {
            setIsImporting(false);
            setProgress(0);
        }
    };

    return (
        <div>
            {isImporting && (
                <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                        Importando produtos...
                    </p>
                    <ProgressBar 
                        progress={progress} 
                        variant="primary"
                        showLabel
                    />
                </div>
            )}
        </div>
    );
}
```

---

## 🎨 Customização

### **Skeleton com Animação Wave**

```tsx
<Skeleton animation="wave" className="w-full h-12" />
```

### **Spinner Customizado**

```tsx
<Spinner 
    size="lg" 
    variant="primary"
    className="border-4"
/>
```

### **Empty State Customizado**

```tsx
<EmptyState
    icon={
        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <HiOutlineShoppingCart className="w-10 h-10 text-primary-600" />
        </div>
    }
    title="Carrinho Vazio"
    description="Adicione produtos ao carrinho para continuar"
    action={{
        label: "Ver Produtos",
        onClick: () => navigate('/products')
    }}
/>
```

---

## ✅ Checklist de Implementação

Ao adicionar loading states em uma página:

- [ ] **Loading inicial**: Skeleton ou Spinner
- [ ] **Error state**: ErrorState com ação de retry
- [ ] **Empty state**: NoItems ou NoDataFound
- [ ] **No results**: NoResultsFound quando filtros não retornam dados
- [ ] **Loading em botões**: Spinner + texto "Salvando..."
- [ ] **Operações longas**: ProgressBar quando aplicável
- [ ] **Feedback visual**: Toast notifications para sucesso/erro

---

## 🚀 Próximos Passos

1. Aplicar esses padrões em todas as páginas
2. Substituir loading states antigos
3. Adicionar empty states onde faltam
4. Testar em diferentes cenários (loading, error, empty)
5. Garantir acessibilidade (aria-labels, roles)

---

**Última atualização:** 24/12/2024  
**Versão:** 1.0.0
