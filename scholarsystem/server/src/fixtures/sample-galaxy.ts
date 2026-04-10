// Large biology-themed galaxy fixture for frontend development.
//
// 9 topics, 23 subtopics, 73 concepts (70 in subtopics + 3 loose),
// 128 spatial bodies, full visuals, 29 relationships.
//
// Validated against the Galaxy Zod schema at import time — fails loudly
// if the schema drifts from this shape.

import { Galaxy } from "../../../shared/types";

const now = Date.now();

// ─── Geometry constants (matching layout.ts) ─────────────────────────

const GEO = {
  galaxyRadius: 900,
  systemSpacing: 500,      // horizontal spacing between systems
  systemRadius: 240,
  starRadius: 30,
  planetRingRadius: 120,
  planetRadius: 22,
  moonRingRadius: 28,
  moonRadius: 7,
  asteroidRadius: 6,
} as const;

// ─── Compact knowledge definition ────────────────────────────────────

interface ConceptDef {
  id: string;
  title: string;
  kind: "definition" | "formula" | "example" | "fact" | "principle" | "process";
  brief: string;
  tier: "light" | "standard" | "heavy";
  srcUnit: number; // index into source units array
}

interface SubtopicDef {
  id: string;
  title: string;
  summary: string;
  concepts: ConceptDef[];
  srcUnit: number;
}

interface TopicDef {
  id: string;
  title: string;
  summary: string;
  subtopics: SubtopicDef[];
  srcUnit: number;
}

const TOPICS: TopicDef[] = [
  {
    id: "w1-cell-biology", title: "Cell Biology", summary: "The fundamental units of life and their inner workings.", srcUnit: 0,
    subtopics: [
      { id: "w1-cell-structure", title: "Cell Structure", summary: "Organelles and membranes that define the cell.", srcUnit: 1, concepts: [
        { id: "w1-plasma-membrane", title: "Plasma Membrane", kind: "definition", brief: "Selectively permeable phospholipid bilayer enclosing the cell.", tier: "standard", srcUnit: 1 },
        { id: "w1-nucleus-function", title: "Nucleus Function", kind: "definition", brief: "Membrane-bound organelle housing the cell's DNA.", tier: "light", srcUnit: 2 },
        { id: "w1-mitochondria", title: "Mitochondria", kind: "definition", brief: "Double-membrane organelle producing ATP via oxidative phosphorylation.", tier: "standard", srcUnit: 3 },
        { id: "w1-ribosomes", title: "Ribosomes", kind: "definition", brief: "Molecular machines that translate mRNA into polypeptides.", tier: "light", srcUnit: 4 },
      ]},
      { id: "w1-cell-division", title: "Cell Division", summary: "How cells reproduce and pass on genetic information.", srcUnit: 5, concepts: [
        { id: "w1-mitosis", title: "Mitosis", kind: "process", brief: "Nuclear division producing two genetically identical daughter cells.", tier: "standard", srcUnit: 5 },
        { id: "w1-meiosis", title: "Meiosis", kind: "process", brief: "Two-stage division producing four haploid gametes.", tier: "heavy", srcUnit: 6 },
        { id: "w1-cell-cycle", title: "Cell Cycle Checkpoints", kind: "principle", brief: "Regulatory mechanisms ensuring proper cell division.", tier: "standard", srcUnit: 7 },
      ]},
      { id: "w1-cell-transport", title: "Cell Transport", summary: "Movement of substances across cell membranes.", srcUnit: 8, concepts: [
        { id: "w1-osmosis", title: "Osmosis", kind: "process", brief: "Diffusion of water across a semipermeable membrane.", tier: "light", srcUnit: 8 },
        { id: "w1-active-transport", title: "Active Transport", kind: "process", brief: "Energy-dependent movement of molecules against concentration gradient.", tier: "standard", srcUnit: 9 },
        { id: "w1-diffusion", title: "Diffusion", kind: "definition", brief: "Net movement of particles from high to low concentration.", tier: "light", srcUnit: 10 },
      ]},
    ],
  },
  {
    id: "w1-genetics", title: "Genetics", summary: "The science of heredity and variation in organisms.", srcUnit: 11,
    subtopics: [
      { id: "w1-dna-rna", title: "DNA & RNA", summary: "The molecular basis of genetic information.", srcUnit: 11, concepts: [
        { id: "w1-dna-double-helix", title: "DNA Double Helix", kind: "definition", brief: "Anti-parallel sugar-phosphate strands connected by complementary base pairs.", tier: "standard", srcUnit: 11 },
        { id: "w1-rna-types", title: "RNA Types", kind: "fact", brief: "mRNA carries code, tRNA carries amino acids, rRNA forms ribosome structure.", tier: "light", srcUnit: 12 },
        { id: "w1-dna-replication", title: "DNA Replication", kind: "process", brief: "Semi-conservative copying of DNA by helicase and DNA polymerase.", tier: "heavy", srcUnit: 13 },
      ]},
      { id: "w1-mendelian", title: "Mendelian Genetics", summary: "Classical inheritance patterns discovered by Gregor Mendel.", srcUnit: 14, concepts: [
        { id: "w1-dominant-recessive", title: "Dominant & Recessive Alleles", kind: "principle", brief: "Dominant alleles mask recessive alleles in heterozygous organisms.", tier: "light", srcUnit: 14 },
        { id: "w1-punnett-squares", title: "Punnett Squares", kind: "example", brief: "Grid tool for predicting genotype ratios in genetic crosses.", tier: "standard", srcUnit: 15 },
        { id: "w1-genotype-phenotype", title: "Genotype vs Phenotype", kind: "definition", brief: "Genotype is the genetic makeup; phenotype is the expressed trait.", tier: "light", srcUnit: 16 },
      ]},
      { id: "w1-gene-expression", title: "Gene Expression", summary: "How genetic information flows from DNA to protein.", srcUnit: 17, concepts: [
        { id: "w1-transcription", title: "Transcription", kind: "process", brief: "RNA polymerase synthesises mRNA from a DNA template.", tier: "standard", srcUnit: 17 },
        { id: "w1-translation", title: "Translation", kind: "process", brief: "Ribosomes decode mRNA codons into a polypeptide chain.", tier: "standard", srcUnit: 18 },
        { id: "w1-mutations", title: "Mutations", kind: "definition", brief: "Heritable changes in the nucleotide sequence of DNA.", tier: "standard", srcUnit: 19 },
      ]},
    ],
  },
  {
    id: "w1-evolution", title: "Evolution", summary: "Change in allele frequencies over generations.", srcUnit: 20,
    subtopics: [
      { id: "w1-natural-selection", title: "Natural Selection", summary: "Differential survival and reproduction based on fitness.", srcUnit: 20, concepts: [
        { id: "w1-fitness", title: "Biological Fitness", kind: "definition", brief: "An organism's ability to survive and reproduce in its environment.", tier: "light", srcUnit: 20 },
        { id: "w1-adaptation", title: "Adaptation", kind: "definition", brief: "Heritable trait increasing an organism's fitness.", tier: "light", srcUnit: 21 },
        { id: "w1-speciation", title: "Speciation", kind: "process", brief: "Formation of new species through reproductive isolation.", tier: "heavy", srcUnit: 22 },
      ]},
      { id: "w1-evolution-evidence", title: "Evidence for Evolution", summary: "Multiple lines of evidence supporting evolutionary theory.", srcUnit: 23, concepts: [
        { id: "w1-fossil-record", title: "Fossil Record", kind: "fact", brief: "Preserved remains showing morphological change across geological time.", tier: "light", srcUnit: 23 },
        { id: "w1-homologous-structures", title: "Homologous Structures", kind: "example", brief: "Anatomically similar structures in different species indicating common ancestry.", tier: "standard", srcUnit: 24 },
        { id: "w1-dna-evidence", title: "Molecular Evidence", kind: "fact", brief: "DNA sequence similarity reflects evolutionary relatedness.", tier: "standard", srcUnit: 25 },
      ]},
      { id: "w1-pop-genetics", title: "Population Genetics", summary: "Allele frequency dynamics in populations.", srcUnit: 26, concepts: [
        { id: "w1-gene-pool", title: "Gene Pool", kind: "definition", brief: "Total collection of alleles in a breeding population.", tier: "light", srcUnit: 26 },
        { id: "w1-hardy-weinberg", title: "Hardy-Weinberg Equilibrium", kind: "formula", brief: "p² + 2pq + q² = 1 predicts genotype frequencies under no evolution.", tier: "heavy", srcUnit: 27 },
        { id: "w1-genetic-drift", title: "Genetic Drift", kind: "process", brief: "Random changes in allele frequencies, strongest in small populations.", tier: "standard", srcUnit: 28 },
      ]},
    ],
  },
  {
    id: "w1-ecology", title: "Ecology", summary: "Interactions between organisms and their environment.", srcUnit: 29,
    subtopics: [
      { id: "w1-ecosystems", title: "Ecosystems", summary: "Communities of organisms and their physical environment.", srcUnit: 29, concepts: [
        { id: "w1-food-webs", title: "Food Webs", kind: "definition", brief: "Interconnected food chains showing energy flow through an ecosystem.", tier: "standard", srcUnit: 29 },
        { id: "w1-trophic-levels", title: "Trophic Levels", kind: "definition", brief: "Hierarchical levels in an ecosystem based on feeding position.", tier: "light", srcUnit: 30 },
        { id: "w1-energy-flow", title: "Energy Flow in Ecosystems", kind: "principle", brief: "Energy transfers between trophic levels with ~10% efficiency.", tier: "standard", srcUnit: 31 },
      ]},
      { id: "w1-pop-dynamics", title: "Population Dynamics", summary: "How populations grow, shrink, and interact.", srcUnit: 32, concepts: [
        { id: "w1-carrying-capacity", title: "Carrying Capacity", kind: "definition", brief: "Maximum population size a habitat can sustain indefinitely.", tier: "light", srcUnit: 32 },
        { id: "w1-growth-curves", title: "Growth Curves", kind: "principle", brief: "Exponential vs logistic growth patterns in populations.", tier: "standard", srcUnit: 33 },
        { id: "w1-competition", title: "Competition", kind: "definition", brief: "Interaction where organisms vie for the same limited resource.", tier: "light", srcUnit: 34 },
      ]},
      { id: "w1-biogeochem", title: "Biogeochemical Cycles", summary: "Recycling of matter through Earth's systems.", srcUnit: 35, concepts: [
        { id: "w1-carbon-cycle", title: "Carbon Cycle", kind: "process", brief: "Movement of carbon through atmosphere, biosphere, hydrosphere, and lithosphere.", tier: "standard", srcUnit: 35 },
        { id: "w1-nitrogen-cycle", title: "Nitrogen Cycle", kind: "process", brief: "Conversion of nitrogen between its various chemical forms.", tier: "heavy", srcUnit: 36 },
        { id: "w1-water-cycle", title: "Water Cycle", kind: "process", brief: "Continuous movement of water through evaporation, condensation, and precipitation.", tier: "light", srcUnit: 37 },
      ]},
    ],
  },
  {
    id: "w1-physiology", title: "Human Physiology", summary: "How the human body systems function.", srcUnit: 38,
    subtopics: [
      { id: "w1-circulatory", title: "Circulatory System", summary: "Transport of blood, nutrients, and gases.", srcUnit: 38, concepts: [
        { id: "w1-heart-structure", title: "Heart Structure", kind: "definition", brief: "Four-chambered muscular organ pumping blood through two circuits.", tier: "standard", srcUnit: 38 },
        { id: "w1-blood-types", title: "Blood Types", kind: "fact", brief: "ABO system determined by surface antigens on red blood cells.", tier: "light", srcUnit: 39 },
        { id: "w1-blood-pressure", title: "Blood Pressure", kind: "definition", brief: "Force exerted by circulating blood on vessel walls (systolic/diastolic).", tier: "light", srcUnit: 40 },
      ]},
      { id: "w1-nervous", title: "Nervous System", summary: "Electrical signalling and coordination.", srcUnit: 41, concepts: [
        { id: "w1-neuron-structure", title: "Neuron Structure", kind: "definition", brief: "Cell body, dendrites, and axon forming the functional unit of the nervous system.", tier: "standard", srcUnit: 41 },
        { id: "w1-synapse", title: "Synaptic Transmission", kind: "process", brief: "Chemical neurotransmitters relay signals across the synaptic cleft.", tier: "heavy", srcUnit: 42 },
        { id: "w1-reflex-arc", title: "Reflex Arc", kind: "process", brief: "Rapid involuntary response: receptor → sensory neuron → relay → motor neuron → effector.", tier: "standard", srcUnit: 43 },
      ]},
      { id: "w1-immune", title: "Immune System", summary: "Defence against pathogens.", srcUnit: 44, concepts: [
        { id: "w1-innate-immunity", title: "Innate Immunity", kind: "definition", brief: "Non-specific first-line defences: skin, phagocytes, inflammation.", tier: "light", srcUnit: 44 },
        { id: "w1-adaptive-immunity", title: "Adaptive Immunity", kind: "definition", brief: "Antigen-specific response involving B and T lymphocytes.", tier: "standard", srcUnit: 45 },
        { id: "w1-antibodies", title: "Antibodies", kind: "definition", brief: "Y-shaped proteins that bind specific antigens for neutralisation.", tier: "standard", srcUnit: 46 },
      ]},
    ],
  },
  {
    id: "w1-plant-biology", title: "Plant Biology", summary: "Structure and function of plants.", srcUnit: 47,
    subtopics: [
      { id: "w1-photosynthesis", title: "Photosynthesis", summary: "Conversion of light energy into chemical energy.", srcUnit: 47, concepts: [
        { id: "w1-light-reactions", title: "Light Reactions", kind: "process", brief: "Thylakoid-based reactions splitting water and generating ATP + NADPH.", tier: "heavy", srcUnit: 47 },
        { id: "w1-calvin-cycle", title: "Calvin Cycle", kind: "process", brief: "Carbon fixation cycle using CO₂ to produce G3P in the stroma.", tier: "heavy", srcUnit: 48 },
        { id: "w1-chloroplast", title: "Chloroplast Structure", kind: "definition", brief: "Double-membrane organelle with thylakoid stacks and stroma.", tier: "standard", srcUnit: 49 },
      ]},
      { id: "w1-plant-structure", title: "Plant Structure", summary: "Tissues and organs of vascular plants.", srcUnit: 50, concepts: [
        { id: "w1-xylem-phloem", title: "Xylem & Phloem", kind: "definition", brief: "Vascular tissues for water/mineral transport (xylem) and sugar transport (phloem).", tier: "standard", srcUnit: 50 },
        { id: "w1-stomata", title: "Stomata", kind: "definition", brief: "Pores on leaf surfaces controlling gas exchange and transpiration.", tier: "light", srcUnit: 51 },
        { id: "w1-root-systems", title: "Root Systems", kind: "definition", brief: "Tap roots and fibrous roots anchoring plants and absorbing water.", tier: "light", srcUnit: 52 },
      ]},
    ],
  },
  {
    id: "w1-microbiology", title: "Microbiology", summary: "The world of microscopic organisms.", srcUnit: 53,
    subtopics: [
      { id: "w1-bacteria", title: "Bacteria", summary: "Prokaryotic organisms with diverse metabolic strategies.", srcUnit: 53, concepts: [
        { id: "w1-bacterial-cell-wall", title: "Bacterial Cell Wall", kind: "definition", brief: "Peptidoglycan layer providing structural support (Gram+ thick, Gram− thin).", tier: "standard", srcUnit: 53 },
        { id: "w1-binary-fission", title: "Binary Fission", kind: "process", brief: "Asexual reproduction where a bacterium divides into two identical cells.", tier: "light", srcUnit: 54 },
        { id: "w1-antibiotic-resistance", title: "Antibiotic Resistance", kind: "process", brief: "Evolution of bacterial populations to survive antibiotic exposure.", tier: "heavy", srcUnit: 55 },
      ]},
      { id: "w1-viruses", title: "Viruses", summary: "Obligate intracellular parasites.", srcUnit: 56, concepts: [
        { id: "w1-viral-structure", title: "Viral Structure", kind: "definition", brief: "Nucleic acid core surrounded by a protein capsid, sometimes an envelope.", tier: "light", srcUnit: 56 },
        { id: "w1-lytic-cycle", title: "Lytic Cycle", kind: "process", brief: "Viral replication ending with host cell lysis and release of new virions.", tier: "standard", srcUnit: 57 },
        { id: "w1-vaccines", title: "Vaccines", kind: "definition", brief: "Preparations that stimulate adaptive immunity without causing disease.", tier: "standard", srcUnit: 58 },
      ]},
    ],
  },
  {
    id: "w1-biochemistry", title: "Biochemistry", summary: "Chemical processes within living organisms.", srcUnit: 59,
    subtopics: [
      { id: "w1-proteins", title: "Proteins", summary: "Polymers of amino acids with diverse biological functions.", srcUnit: 59, concepts: [
        { id: "w1-amino-acids", title: "Amino Acids", kind: "definition", brief: "Monomers with an amino group, carboxyl group, and variable R group.", tier: "light", srcUnit: 59 },
        { id: "w1-protein-folding", title: "Protein Folding", kind: "process", brief: "Polypeptide chains fold into specific 3D shapes dictated by R-group interactions.", tier: "heavy", srcUnit: 60 },
        { id: "w1-enzymes", title: "Enzymes", kind: "definition", brief: "Biological catalysts that lower activation energy of reactions.", tier: "standard", srcUnit: 61 },
      ]},
      { id: "w1-metabolism", title: "Metabolism", summary: "Energy transformations in cells.", srcUnit: 62, concepts: [
        { id: "w1-atp-energy", title: "ATP as Energy Currency", kind: "principle", brief: "Adenosine triphosphate stores and transfers energy via phosphate bonds.", tier: "standard", srcUnit: 62 },
        { id: "w1-glycolysis", title: "Glycolysis", kind: "process", brief: "Splitting glucose into two pyruvate molecules, yielding 2 net ATP.", tier: "heavy", srcUnit: 63 },
        { id: "w1-krebs-cycle", title: "Krebs Cycle", kind: "process", brief: "Acetyl-CoA oxidation producing CO₂, NADH, FADH₂, and GTP.", tier: "heavy", srcUnit: 64 },
      ]},
    ],
  },
  {
    id: "w1-marine-biology", title: "Marine Biology", summary: "Life in the ocean and its ecosystems.", srcUnit: 65,
    subtopics: [
      { id: "w1-ocean-ecosystems", title: "Ocean Ecosystems", summary: "Major marine habitats and their characteristics.", srcUnit: 65, concepts: [
        { id: "w1-coral-reefs", title: "Coral Reefs", kind: "definition", brief: "Calcium carbonate structures built by colonial cnidarians, hosting immense biodiversity.", tier: "standard", srcUnit: 65 },
        { id: "w1-deep-sea-vents", title: "Deep-Sea Hydrothermal Vents", kind: "fact", brief: "Volcanic fissures supporting chemosynthetic ecosystems independent of sunlight.", tier: "standard", srcUnit: 66 },
        { id: "w1-photic-zones", title: "Photic Zones", kind: "definition", brief: "Ocean layers defined by light penetration: euphotic, dysphotic, aphotic.", tier: "light", srcUnit: 67 },
      ]},
      { id: "w1-marine-organisms", title: "Marine Organisms", summary: "Key groups of ocean-dwelling life.", srcUnit: 68, concepts: [
        { id: "w1-plankton", title: "Plankton", kind: "definition", brief: "Drifting organisms (phyto- and zooplankton) forming the ocean's productivity base.", tier: "light", srcUnit: 68 },
        { id: "w1-cephalopods", title: "Cephalopods", kind: "fact", brief: "Molluscs including octopus and squid with complex nervous systems.", tier: "light", srcUnit: 69 },
        { id: "w1-marine-mammals", title: "Marine Mammals", kind: "fact", brief: "Air-breathing endotherms adapted to aquatic life: whales, dolphins, seals.", tier: "light", srcUnit: 70 },
      ]},
    ],
  },
];

const LOOSE_CONCEPTS: ConceptDef[] = [
  { id: "w1-scientific-method", title: "Scientific Method", kind: "process", brief: "Systematic observation, hypothesis, experimentation, and conclusion.", tier: "light", srcUnit: 71 },
  { id: "w1-bioinformatics", title: "Bioinformatics", kind: "definition", brief: "Computational analysis of biological data, especially DNA sequences.", tier: "standard", srcUnit: 72 },
  { id: "w1-crispr", title: "CRISPR Gene Editing", kind: "process", brief: "Cas9-guided DNA editing enabling precise genetic modifications.", tier: "heavy", srcUnit: 73 },
];

// ─── Source units ────────────────────────────────────────────────────

const SOURCE_TEXTS = [
  "The cell is the basic structural and functional unit of all living organisms.",
  "The plasma membrane is a selectively permeable phospholipid bilayer that regulates what enters and exits the cell.",
  "The nucleus is a membrane-bound organelle that contains the cell's genetic material in the form of chromatin.",
  "Mitochondria are double-membrane organelles that produce ATP through oxidative phosphorylation.",
  "Ribosomes are molecular machines composed of rRNA and protein that translate mRNA into polypeptides.",
  "Mitosis is a type of cell division resulting in two genetically identical daughter nuclei.",
  "Meiosis involves two rounds of division producing four haploid gametes with genetic variation.",
  "Cell cycle checkpoints ensure DNA integrity and proper chromosome segregation before division proceeds.",
  "Osmosis is the net movement of water molecules through a semipermeable membrane from low to high solute concentration.",
  "Active transport uses ATP to move molecules against their concentration gradient across a membrane.",
  "Diffusion is the passive movement of particles from a region of higher concentration to lower concentration.",
  "DNA consists of two anti-parallel polynucleotide strands wound into a double helix, joined by complementary base pairs.",
  "Three major types of RNA exist: messenger RNA carries the genetic code, transfer RNA delivers amino acids, and ribosomal RNA forms the ribosome core.",
  "DNA replication is semi-conservative: each new molecule contains one original and one newly synthesised strand.",
  "In Mendelian genetics, dominant alleles mask the expression of recessive alleles in heterozygous individuals.",
  "Punnett squares are a grid-based tool used to predict the genotype ratios of offspring from a genetic cross.",
  "Genotype refers to the genetic composition of an organism, while phenotype is the observable expression of those genes.",
  "Transcription is the process by which RNA polymerase synthesises an mRNA molecule from a DNA template strand.",
  "Translation occurs at the ribosome, where mRNA codons are decoded into a sequence of amino acids forming a polypeptide.",
  "A mutation is a heritable change in the nucleotide sequence of an organism's DNA.",
  "Natural selection acts on phenotypic variation, favouring traits that increase survival and reproductive success.",
  "An adaptation is a heritable trait that has been shaped by natural selection to improve fitness in a given environment.",
  "Speciation occurs when populations become reproductively isolated and diverge genetically over time.",
  "The fossil record provides morphological evidence of organisms that lived in the past, showing transitional forms.",
  "Homologous structures are anatomically similar features in different species that indicate common ancestry.",
  "Molecular evidence from DNA and protein sequences quantifies evolutionary relatedness among species.",
  "A gene pool is the total collection of all alleles for every gene in a breeding population.",
  "The Hardy-Weinberg equation p² + 2pq + q² = 1 predicts genotype frequencies in a non-evolving population.",
  "Genetic drift causes random fluctuations in allele frequencies, especially pronounced in small populations.",
  "An ecosystem comprises a community of living organisms interacting with their abiotic environment.",
  "Trophic levels describe the position of an organism in a food chain: producers, primary consumers, secondary consumers, and so on.",
  "The 10% rule states that roughly 10% of energy is transferred from one trophic level to the next.",
  "Carrying capacity is the maximum population size that an environment can sustain indefinitely given available resources.",
  "Populations may exhibit exponential (J-shaped) or logistic (S-shaped) growth depending on resource availability.",
  "Competition occurs when two or more organisms require the same limited resource, such as food, light, or territory.",
  "The carbon cycle describes the movement of carbon atoms through the atmosphere, biosphere, hydrosphere, and lithosphere.",
  "Nitrogen fixation, nitrification, and denitrification are key steps in the nitrogen cycle.",
  "The water cycle involves evaporation from surface water, condensation in the atmosphere, and precipitation back to Earth.",
  "The human heart is a four-chambered organ that pumps blood through the pulmonary and systemic circuits.",
  "The ABO blood type system is determined by the presence or absence of A and B antigens on red blood cells.",
  "Blood pressure measures the force of blood against arterial walls, expressed as systolic over diastolic values.",
  "Neurons consist of a cell body, dendrites that receive signals, and an axon that transmits signals.",
  "At a synapse, an action potential triggers release of neurotransmitters across the synaptic cleft to the postsynaptic cell.",
  "A reflex arc is a rapid, involuntary neural pathway: receptor, sensory neuron, relay neuron, motor neuron, effector.",
  "Innate immunity provides immediate, non-specific defence through barriers such as skin and phagocytic cells.",
  "Adaptive immunity involves antigen-specific B and T lymphocytes that form immunological memory.",
  "Antibodies are Y-shaped immunoglobulins secreted by plasma cells that bind and neutralise specific antigens.",
  "Photosynthesis converts light energy into chemical energy, producing glucose and oxygen from CO₂ and water.",
  "The Calvin cycle fixes CO₂ into G3P using ATP and NADPH generated by the light reactions.",
  "Chloroplasts contain thylakoid membranes arranged in grana stacks, surrounded by a fluid stroma.",
  "Xylem transports water and minerals upward, while phloem distributes sugars throughout the plant.",
  "Stomata are pores bounded by guard cells that open and close to regulate gas exchange and water loss.",
  "Root systems anchor the plant and absorb water and mineral ions from the soil.",
  "Bacteria possess a peptidoglycan cell wall; Gram-positive bacteria have a thick layer, Gram-negative a thin one.",
  "Binary fission is the primary mode of bacterial reproduction, producing two genetically identical daughter cells.",
  "Antibiotic resistance arises through mutations or horizontal gene transfer and spreads via natural selection.",
  "A virus consists of a nucleic acid genome (DNA or RNA) enclosed in a protein capsid, sometimes with a lipid envelope.",
  "In the lytic cycle, a virus hijacks host machinery to replicate, ultimately lysing the cell to release new virions.",
  "Vaccines expose the immune system to a harmless form of a pathogen, priming adaptive immunity without causing disease.",
  "Amino acids are organic molecules with an amino group, a carboxyl group, and a variable R-group side chain.",
  "Protein folding is driven by hydrophobic interactions, hydrogen bonds, and disulphide bridges between R-groups.",
  "Enzymes are biological catalysts that lower the activation energy of reactions by stabilising the transition state.",
  "ATP stores energy in its high-energy phosphate bonds and transfers it to endergonic reactions via hydrolysis.",
  "Glycolysis splits one glucose molecule into two pyruvate molecules, yielding a net gain of 2 ATP.",
  "The Krebs cycle oxidises acetyl-CoA, producing CO₂, NADH, FADH₂, and GTP in the mitochondrial matrix.",
  "Coral reefs are underwater structures built by calcium carbonate-secreting cnidarians, hosting 25% of marine species.",
  "Hydrothermal vents on the ocean floor support unique chemosynthetic ecosystems independent of solar energy.",
  "The ocean is divided into photic (sunlit), dysphotic (twilight), and aphotic (dark) zones based on light penetration.",
  "Plankton are drifting organisms: phytoplankton photosynthesise, zooplankton consume other plankton.",
  "Cephalopods such as octopuses and squid are molluscs with large brains, camera-type eyes, and chromatophores.",
  "Marine mammals — whales, dolphins, and seals — are air-breathing endotherms secondarily adapted to aquatic life.",
  "The scientific method involves observation, hypothesis formation, controlled experimentation, and analysis.",
  "Bioinformatics uses computational tools to analyse biological data sets, particularly genomic sequences.",
  "CRISPR-Cas9 is a gene editing technology that uses a guide RNA to direct Cas9 nuclease to a specific DNA locus.",
  "Biology is the study of living organisms, their structure, function, growth, origin, evolution, and distribution.",
];

const sourceUnits = SOURCE_TEXTS.map((text, i) => {
  const charStart = i * 120;
  return {
    id: `w1-s-${String(i + 1).padStart(4, "0")}`,
    text,
    charStart,
    charEnd: charStart + text.length,
  };
});

// ─── Build knowledge ─────────────────────────────────────────────────

function srcRef(unitIdx: number) {
  return `w1-s-${String(unitIdx + 1).padStart(4, "0")}`;
}

const knowledgeTopics = TOPICS.map((t) => ({
  id: t.id,
  chapter: "w1" as const,
  title: t.title,
  summary: t.summary,
  subtopicIds: t.subtopics.map((s) => s.id),
  sourceRefs: [srcRef(t.srcUnit)],
}));

const knowledgeSubtopics = TOPICS.flatMap((t) =>
  t.subtopics.map((s) => ({
    id: s.id,
    chapter: "w1" as const,
    title: s.title,
    summary: s.summary,
    conceptIds: s.concepts.map((c) => c.id),
    sourceRefs: [srcRef(s.srcUnit)],
  })),
);

const knowledgeConcepts = [
  ...TOPICS.flatMap((t) =>
    t.subtopics.flatMap((s) =>
      s.concepts.map((c) => ({
        id: c.id,
        chapter: "w1" as const,
        title: c.title,
        kind: c.kind,
        brief: c.brief,
        modelTier: c.tier,
        sourceRefs: [srcRef(c.srcUnit)],
      })),
    ),
  ),
  ...LOOSE_CONCEPTS.map((c) => ({
    id: c.id,
    chapter: "w1" as const,
    title: c.title,
    kind: c.kind,
    brief: c.brief,
    modelTier: c.tier,
    sourceRefs: [srcRef(c.srcUnit)],
  })),
];

// ─── Build spatial bodies ────────────────────────────────────────────

type AnyBody = Record<string, unknown>;
const bodies: AnyBody[] = [];
const allKnowledgeIds: string[] = [];
const allBodyIds: string[] = [];

// Root galaxy — wide horizontal bounds
const rootId = "w1-root-galaxy";
bodies.push({
  kind: "galaxy", id: rootId, position: { x: 0, y: 0 },
  parentId: null, radius: GEO.galaxyRadius, knowledgeRef: null,
});
allBodyIds.push(rootId);

const spectralClasses = ["G", "K", "M", "F", "A", "B", "O"] as const;

// Horizontal layout: systems spaced left-to-right with gentle y wave
const totalWidth = (TOPICS.length - 1) * GEO.systemSpacing;
const startX = -totalWidth / 2;

// Color families per topic (primary, secondary, accent, atmosphere)
const TOPIC_PALETTES: Array<{ primary: string; secondary: string; accent: string; atmosphere: string }> = [
  { primary: "#1a3a2a", secondary: "#0d1f15", accent: "#4ade80", atmosphere: "rgba(74,222,128,0.2)" },   // cell bio - green
  { primary: "#2a1a3d", secondary: "#150d28", accent: "#a78bfa", atmosphere: "rgba(167,139,250,0.2)" },  // genetics - purple
  { primary: "#3d2a1a", secondary: "#281a0d", accent: "#fb923c", atmosphere: "rgba(251,146,60,0.2)" },   // evolution - orange
  { primary: "#1a2a3d", secondary: "#0d1528", accent: "#38bdf8", atmosphere: "rgba(56,189,248,0.2)" },   // ecology - blue
  { primary: "#3d1a2a", secondary: "#280d15", accent: "#f472b6", atmosphere: "rgba(244,114,182,0.2)" },  // physiology - pink
  { primary: "#2a3d1a", secondary: "#15280d", accent: "#a3e635", atmosphere: "rgba(163,230,53,0.2)" },   // plant bio - lime
  { primary: "#3d3a1a", secondary: "#28250d", accent: "#facc15", atmosphere: "rgba(250,204,21,0.2)" },   // microbiology - yellow
  { primary: "#1a3d3d", secondary: "#0d2828", accent: "#2dd4bf", atmosphere: "rgba(45,212,191,0.2)" },   // biochemistry - teal
  { primary: "#1a1a3d", secondary: "#0d0d28", accent: "#818cf8", atmosphere: "rgba(129,140,248,0.2)" },  // marine - indigo
];

const TERRAINS = ["organic", "crystalline", "rocky", "gaseous", "molten", "frozen", "oceanic", "desert", "metallic"] as const;
const ATMOSPHERES = ["thin", "dense-haze", "stormy", "clear", "toxic", "aurora", "none"] as const;
const LIGHTINGS = ["bioluminescent", "sunlit", "twilight", "eclipsed", "nebula-lit", "starlight"] as const;

// Visuals record
const vis: Record<string, Record<string, unknown>> = {};

vis[rootId] = {
  kind: "galaxy",
  palette: { primary: "#020810", secondary: "#0a1428", accent: "#ffb547", atmosphere: "rgba(10,20,40,0.5)" },
  armStyle: "spiral",
  starDensity: 0.7,
};

TOPICS.forEach((topic, ti) => {
  // Horizontal linear layout with gentle sine wave for organic feel
  const sx = Math.round(startX + ti * GEO.systemSpacing);
  const sy = Math.round(Math.sin(ti * 0.7) * 60);
  const systemId = `w1-sys-${topic.id.replace("w1-", "")}`;
  const starId = `w1-star-${topic.id.replace("w1-", "")}`;
  const pal = TOPIC_PALETTES[ti];

  allKnowledgeIds.push(topic.id);
  allBodyIds.push(systemId, starId);

  bodies.push({
    kind: "system", id: systemId, position: { x: sx, y: sy },
    parentId: rootId, radius: GEO.systemRadius, knowledgeRef: topic.id,
  });

  bodies.push({
    kind: "star", id: starId, position: { x: sx, y: sy },
    parentId: systemId, radius: GEO.starRadius,
    spectralClass: spectralClasses[ti % spectralClasses.length],
  });

  vis[systemId] = {
    kind: "system",
    palette: { ...pal },
    starGlow: 0.5 + (ti % 3) * 0.2,
    orbitRingVisible: true,
  };

  vis[starId] = {
    kind: "star",
    palette: { primary: pal.accent, secondary: pal.primary, accent: "#ffffff", atmosphere: pal.atmosphere },
    coronaIntensity: 0.5 + (ti % 4) * 0.15,
    pulseRate: 0.2 + (ti % 3) * 0.15,
  };

  topic.subtopics.forEach((subtopic, pi) => {
    const pAngle = (pi / Math.max(topic.subtopics.length, 1)) * Math.PI * 2 + ti * 0.7;
    const px = Math.round(sx + Math.cos(pAngle) * GEO.planetRingRadius);
    const py = Math.round(sy + Math.sin(pAngle) * GEO.planetRingRadius);
    const planetId = `w1-planet-${subtopic.id.replace("w1-", "")}`;

    allKnowledgeIds.push(subtopic.id);
    allBodyIds.push(planetId);

    bodies.push({
      kind: "planet", id: planetId, position: { x: px, y: py },
      parentId: systemId, radius: GEO.planetRadius, knowledgeRef: subtopic.id,
      orbitRadius: GEO.planetRingRadius, orbitAngle: pAngle,
    });

    vis[planetId] = {
      kind: "planet",
      palette: {
        primary: pal.primary,
        secondary: pal.secondary,
        accent: pal.accent,
        atmosphere: pal.atmosphere.replace("0.2", "0.3"),
      },
      terrain: TERRAINS[(ti + pi) % TERRAINS.length],
      atmosphere: ATMOSPHERES[(ti + pi) % ATMOSPHERES.length],
      lighting: LIGHTINGS[(ti + pi) % LIGHTINGS.length],
      features: [`${subtopic.title.toLowerCase()} formations`, "ridges"],
      mood: ["mysterious", "serene", "volatile", "ancient", "vibrant"][(ti + pi) % 5],
      ring: pi === 0 && ti % 3 === 0,
    };

    subtopic.concepts.forEach((concept, mi) => {
      const mAngle = (mi / Math.max(subtopic.concepts.length, 1)) * Math.PI * 2;
      const mx = Math.round(px + Math.cos(mAngle) * GEO.moonRingRadius);
      const my = Math.round(py + Math.sin(mAngle) * GEO.moonRingRadius);
      const moonId = `w1-moon-${concept.id.replace("w1-", "")}`;

      allKnowledgeIds.push(concept.id);
      allBodyIds.push(moonId);

      bodies.push({
        kind: "moon", id: moonId, position: { x: mx, y: my },
        parentId: planetId, radius: GEO.moonRadius, knowledgeRef: concept.id,
        orbitRadius: GEO.moonRingRadius, orbitAngle: mAngle,
      });

      const lightness = concept.tier === "heavy" ? 0.8 : concept.tier === "standard" ? 0.6 : 0.4;
      vis[moonId] = {
        kind: "moon",
        palette: {
          primary: pal.accent,
          secondary: pal.primary,
          accent: "#ffffff",
          atmosphere: pal.atmosphere.replace("0.2", String(lightness * 0.4)),
        },
        terrain: TERRAINS[(ti + pi + mi) % TERRAINS.length],
        cratered: mi % 2 === 0,
        glow: concept.tier === "heavy",
      };
    });
  });
});

// Loose asteroids — scattered between systems along the path
LOOSE_CONCEPTS.forEach((concept, i) => {
  const ax = Math.round(startX + (i + 0.5) * GEO.systemSpacing * 3 - GEO.systemSpacing);
  const ay = Math.round(180 + i * 30);
  const asteroidId = `w1-asteroid-${concept.id.replace("w1-", "")}`;

  allKnowledgeIds.push(concept.id);
  allBodyIds.push(asteroidId);

  bodies.push({
    kind: "asteroid", id: asteroidId,
    position: { x: ax, y: ay },
    parentId: rootId, radius: GEO.asteroidRadius, knowledgeRef: concept.id,
  });

  vis[asteroidId] = {
    kind: "asteroid",
    palette: { primary: "#6e6457", secondary: "#332e28", accent: "#c4b89a", atmosphere: "rgba(0,0,0,0)" },
    shape: (["angular", "elongated", "clustered"] as const)[i % 3],
  };
});

// Decoratives — small, scattered along the horizontal path as background ambiance
const hW = totalWidth / 2 + 300; // horizontal spread
const decoratives: Array<AnyBody & { visEntry: Record<string, unknown> }> = [
  { kind: "nebula", id: "w1-nebula-1", position: { x: Math.round(-hW * 0.8), y: -220 }, parentId: rootId, radius: 80,
    visEntry: { kind: "nebula", palette: { primary: "#4a1b70", secondary: "#1a0533", accent: "#b266ff", atmosphere: "rgba(74,27,112,0.15)" }, density: 0.2, swirl: 0.3 } },
  { kind: "nebula", id: "w1-nebula-2", position: { x: Math.round(hW * 0.3), y: 250 }, parentId: rootId, radius: 60,
    visEntry: { kind: "nebula", palette: { primary: "#1b4a70", secondary: "#05331a", accent: "#66b2ff", atmosphere: "rgba(27,74,112,0.12)" }, density: 0.15, swirl: 0.4 } },
  { kind: "nebula", id: "w1-nebula-3", position: { x: Math.round(hW * 0.7), y: -180 }, parentId: rootId, radius: 70,
    visEntry: { kind: "nebula", palette: { primary: "#4a701b", secondary: "#33051a", accent: "#b2ff66", atmosphere: "rgba(74,112,27,0.1)" }, density: 0.15, swirl: 0.2 } },
  { kind: "dust-cloud", id: "w1-dust-1", position: { x: Math.round(-hW * 0.4), y: 200 }, parentId: rootId, radius: 60,
    visEntry: { kind: "dust-cloud", palette: { primary: "#3a2a4a", secondary: "#1a1020", accent: "#6a4a80", atmosphere: "rgba(58,42,74,0.15)" }, opacity: 0.12 } },
  { kind: "dust-cloud", id: "w1-dust-2", position: { x: Math.round(hW * 0.5), y: -200 }, parentId: rootId, radius: 50,
    visEntry: { kind: "dust-cloud", palette: { primary: "#2a3a4a", secondary: "#101a20", accent: "#4a6a80", atmosphere: "rgba(42,58,74,0.1)" }, opacity: 0.1 } },
  { kind: "comet", id: "w1-comet-1", position: { x: Math.round(hW * 0.9), y: -120 }, parentId: rootId, radius: 3, trajectoryAngle: 2.2,
    visEntry: { kind: "comet", palette: { primary: "#a0c4ff", secondary: "#4a6bff", accent: "#ffffff", atmosphere: "rgba(0,0,0,0)" }, tailLength: 30 } },
  { kind: "comet", id: "w1-comet-2", position: { x: Math.round(-hW * 0.6), y: 150 }, parentId: rootId, radius: 3, trajectoryAngle: 4.0,
    visEntry: { kind: "comet", palette: { primary: "#ffa0c4", secondary: "#ff4a6b", accent: "#ffffff", atmosphere: "rgba(0,0,0,0)" }, tailLength: 25 } },
  { kind: "black-hole", id: "w1-bh-1", position: { x: Math.round(hW * 0.95), y: 180 }, parentId: rootId, radius: 10,
    visEntry: { kind: "black-hole", palette: { primary: "#000000", secondary: "#1a0033", accent: "#7a3cff", atmosphere: "rgba(122,60,255,0.2)" }, accretionIntensity: 0.6 } },
];

for (const d of decoratives) {
  const { visEntry, ...body } = d;
  bodies.push(body);
  allBodyIds.push(body.id as string);
  vis[body.id as string] = visEntry;
}

// ─── Relationships ───────────────────────────────────────────────────

const rels = [
  // Intra cell-biology
  { from: "w1-plasma-membrane", to: "w1-osmosis", kind: "related", sourceRefs: [srcRef(1), srcRef(8)] },
  { from: "w1-plasma-membrane", to: "w1-active-transport", kind: "related", sourceRefs: [srcRef(1), srcRef(9)] },
  { from: "w1-mitochondria", to: "w1-atp-energy", kind: "prerequisite", sourceRefs: [srcRef(3), srcRef(62)] },
  { from: "w1-ribosomes", to: "w1-translation", kind: "prerequisite", sourceRefs: [srcRef(4), srcRef(18)] },
  { from: "w1-mitosis", to: "w1-meiosis", kind: "related", sourceRefs: [srcRef(5), srcRef(6)] },
  { from: "w1-cell-cycle", to: "w1-mitosis", kind: "prerequisite", sourceRefs: [srcRef(7), srcRef(5)] },
  // Intra genetics
  { from: "w1-dna-double-helix", to: "w1-dna-replication", kind: "prerequisite", sourceRefs: [srcRef(11), srcRef(13)] },
  { from: "w1-transcription", to: "w1-translation", kind: "prerequisite", sourceRefs: [srcRef(17), srcRef(18)] },
  { from: "w1-mutations", to: "w1-antibiotic-resistance", kind: "related", sourceRefs: [srcRef(19), srcRef(55)] },
  { from: "w1-genotype-phenotype", to: "w1-dominant-recessive", kind: "related", sourceRefs: [srcRef(16), srcRef(14)] },
  // Cross: genetics → evolution
  { from: "w1-mutations", to: "w1-genetic-drift", kind: "related", sourceRefs: [srcRef(19), srcRef(28)] },
  { from: "w1-dna-evidence", to: "w1-dna-double-helix", kind: "related", sourceRefs: [srcRef(25), srcRef(11)] },
  { from: "w1-gene-pool", to: "w1-hardy-weinberg", kind: "prerequisite", sourceRefs: [srcRef(26), srcRef(27)] },
  // Intra ecology
  { from: "w1-trophic-levels", to: "w1-energy-flow", kind: "prerequisite", sourceRefs: [srcRef(30), srcRef(31)] },
  { from: "w1-food-webs", to: "w1-trophic-levels", kind: "related", sourceRefs: [srcRef(29), srcRef(30)] },
  { from: "w1-carrying-capacity", to: "w1-growth-curves", kind: "prerequisite", sourceRefs: [srcRef(32), srcRef(33)] },
  // Cross: ecology → plant biology
  { from: "w1-energy-flow", to: "w1-light-reactions", kind: "related", sourceRefs: [srcRef(31), srcRef(47)] },
  { from: "w1-carbon-cycle", to: "w1-calvin-cycle", kind: "related", sourceRefs: [srcRef(35), srcRef(48)] },
  // Cross: physiology → cell biology
  { from: "w1-neuron-structure", to: "w1-plasma-membrane", kind: "related", sourceRefs: [srcRef(41), srcRef(1)] },
  { from: "w1-antibodies", to: "w1-adaptive-immunity", kind: "prerequisite", sourceRefs: [srcRef(46), srcRef(45)] },
  // Cross: microbiology → immune
  { from: "w1-vaccines", to: "w1-adaptive-immunity", kind: "related", sourceRefs: [srcRef(58), srcRef(45)] },
  { from: "w1-lytic-cycle", to: "w1-innate-immunity", kind: "related", sourceRefs: [srcRef(57), srcRef(44)] },
  // Intra biochemistry
  { from: "w1-amino-acids", to: "w1-protein-folding", kind: "prerequisite", sourceRefs: [srcRef(59), srcRef(60)] },
  { from: "w1-enzymes", to: "w1-glycolysis", kind: "related", sourceRefs: [srcRef(61), srcRef(63)] },
  { from: "w1-glycolysis", to: "w1-krebs-cycle", kind: "prerequisite", sourceRefs: [srcRef(63), srcRef(64)] },
  { from: "w1-atp-energy", to: "w1-glycolysis", kind: "related", sourceRefs: [srcRef(62), srcRef(63)] },
  // Cross: biochemistry → cell bio
  { from: "w1-atp-energy", to: "w1-active-transport", kind: "prerequisite", sourceRefs: [srcRef(62), srcRef(9)] },
  // Cross: marine → ecology
  { from: "w1-coral-reefs", to: "w1-food-webs", kind: "example-of", sourceRefs: [srcRef(65), srcRef(29)] },
  { from: "w1-plankton", to: "w1-trophic-levels", kind: "example-of", sourceRefs: [srcRef(68), srcRef(30)] },
];

// ─── Detail (sample 6 concepts) ──────────────────────────────────────

const detail: Record<string, unknown> = {
  "w1-plasma-membrane": {
    conceptId: "w1-plasma-membrane", chapter: "w1",
    fullDefinition: "The plasma membrane is a selectively permeable barrier composed of a phospholipid bilayer with embedded proteins. The hydrophilic heads face outward while hydrophobic tails face inward, creating a fluid mosaic structure that regulates the passage of ions, nutrients, and waste.",
    formulas: [],
    workedExamples: ["Red blood cells placed in a hypotonic solution swell as water crosses the plasma membrane by osmosis."],
    edgeCases: ["Some small nonpolar molecules like O₂ and CO₂ can diffuse directly through the bilayer without transport proteins."],
    mnemonics: [],
    emphasisMarkers: ["Emphasized: the fluid mosaic model is the accepted description of membrane structure."],
    sourceQuotes: ["The plasma membrane is a selectively permeable phospholipid bilayer that regulates what enters and exits the cell."],
    sourceRefs: [srcRef(1)],
    extractedAt: now - 7500,
  },
  "w1-dna-double-helix": {
    conceptId: "w1-dna-double-helix", chapter: "w1",
    fullDefinition: "DNA is a double-stranded helix of nucleotides. Each nucleotide contains a deoxyribose sugar, a phosphate group, and one of four nitrogenous bases (A, T, G, C). Adenine pairs with thymine via two hydrogen bonds; guanine pairs with cytosine via three.",
    formulas: [],
    workedExamples: ["If one strand reads 5'-ATCGGTA-3', the complementary strand reads 3'-TAGCCAT-5'."],
    edgeCases: ["Z-DNA is a left-handed helix that can form under certain conditions but is not the predominant form."],
    mnemonics: ["AT pairs and GC pairs — 'All Tigers Go Crazy'."],
    emphasisMarkers: [],
    sourceQuotes: [],
    sourceRefs: [srcRef(11)],
    extractedAt: now - 7000,
  },
  "w1-hardy-weinberg": {
    conceptId: "w1-hardy-weinberg", chapter: "w1",
    fullDefinition: "The Hardy-Weinberg principle states that allele and genotype frequencies in a population remain constant across generations in the absence of evolutionary forces. The equation p² + 2pq + q² = 1 predicts genotype frequencies from allele frequencies p and q.",
    formulas: ["p² + 2pq + q² = 1", "p + q = 1"],
    workedExamples: ["If q = 0.3 (frequency of recessive allele), then q² = 0.09 (9% homozygous recessive), p = 0.7, p² = 0.49 (49% homozygous dominant), 2pq = 0.42 (42% heterozygous)."],
    edgeCases: ["Requires five conditions: no mutation, random mating, no selection, large population, no gene flow."],
    mnemonics: [],
    emphasisMarkers: ["Emphasized: deviation from Hardy-Weinberg indicates evolution is occurring."],
    sourceQuotes: [],
    sourceRefs: [srcRef(27)],
    extractedAt: now - 6500,
  },
  "w1-light-reactions": {
    conceptId: "w1-light-reactions", chapter: "w1",
    fullDefinition: "The light-dependent reactions occur in the thylakoid membranes and use photosystems I and II to capture light energy, split water (photolysis), and generate ATP and NADPH. The electron transport chain creates a proton gradient driving ATP synthase.",
    formulas: ["2H₂O → O₂ + 4H⁺ + 4e⁻"],
    workedExamples: ["Photosystem II absorbs light at 680 nm, splitting water and passing electrons to plastoquinone."],
    edgeCases: ["Cyclic photophosphorylation uses only PSI and produces ATP but not NADPH."],
    mnemonics: [],
    emphasisMarkers: [],
    sourceQuotes: [],
    sourceRefs: [srcRef(47)],
    extractedAt: now - 6000,
  },
  "w1-glycolysis": {
    conceptId: "w1-glycolysis", chapter: "w1",
    fullDefinition: "Glycolysis is a ten-step metabolic pathway occurring in the cytoplasm that breaks down one glucose molecule into two pyruvate molecules, with a net yield of 2 ATP and 2 NADH. It does not require oxygen and is thus common to both aerobic and anaerobic respiration.",
    formulas: ["C₆H₁₂O₆ + 2 NAD⁺ + 2 ADP + 2 Pᵢ → 2 C₃H₄O₃ + 2 NADH + 2 ATP + 2 H₂O"],
    workedExamples: ["In the energy investment phase, 2 ATP are consumed; in the energy payoff phase, 4 ATP and 2 NADH are produced."],
    edgeCases: ["Under anaerobic conditions, pyruvate is converted to lactate (animals) or ethanol (yeast) to regenerate NAD⁺."],
    mnemonics: [],
    emphasisMarkers: ["Emphasized: glycolysis is the universal first step of glucose metabolism."],
    sourceQuotes: [],
    sourceRefs: [srcRef(63)],
    extractedAt: now - 5500,
  },
  "w1-synapse": {
    conceptId: "w1-synapse", chapter: "w1",
    fullDefinition: "Synaptic transmission is the process by which a nerve impulse is transferred from one neuron to another across the synaptic cleft. When an action potential arrives at the presynaptic terminal, voltage-gated Ca²⁺ channels open, triggering vesicle fusion and neurotransmitter release.",
    formulas: [],
    workedExamples: ["Acetylcholine released at the neuromuscular junction binds to nicotinic receptors on the muscle fibre, triggering contraction."],
    edgeCases: ["Electrical synapses use gap junctions for direct ion flow and are faster but less modulable than chemical synapses."],
    mnemonics: [],
    emphasisMarkers: [],
    sourceQuotes: [],
    sourceRefs: [srcRef(42)],
    extractedAt: now - 5000,
  },
};

// ─── Narrative ───────────────────────────────────────────────────────

const narrative = {
  canon: {
    setting: "The bioluminescent interior of the Thalassa, an ancient bioship drifting through a living galaxy where every star system pulses with organic light.",
    protagonist: "You are a newly awakened Symbiont — a bio-navigator bonded to the Thalassa, tasked with mapping the living systems of this organic cosmos.",
    premise: "Each world harbours a fragment of the Codex Vitae, a repository of biological knowledge left by the Architects who grew this galaxy from a single seed cell. Recover the fragments, and the Thalassa will remember how to grow again.",
    stakes: "The Thalassa is dying. Without the Codex, its bio-systems will shut down one by one, and the living galaxy will calcify into lifeless stone.",
    tone: {
      primary: "wondrous" as const,
      secondary: "with an undertow of urgency",
      genre: "exploration" as const,
    },
    aesthetic: {
      paletteDirection: "bioluminescent teals and greens, deep organic purples, warm amber growth-light",
      atmosphereDirection: "floating spores, gentle bioluminescent currents, the hum of living walls",
      motifKeywords: ["bioluminescence", "membranes", "growth", "symbiosis", "codex", "spores", "currents", "tendrils", "pulse", "veins"],
    },
    recurringCharacters: [
      {
        id: "w1-the-archivist",
        name: "The Archivist",
        role: "guide",
        description: "A translucent figure formed from the Thalassa's memory banks — part hologram, part living tissue. Appears wherever Codex fragments surface.",
        voice: "Speaks in precise, measured sentences. Uses biological metaphors naturally. Addresses the player as 'Symbiont'. Never uses contractions.",
        arc: "Becomes more complete — fills in missing organs and features — as more Codex fragments are recovered.",
      },
    ],
    finaleHook: "At the Thalassa's core, the final Codex fragment reveals that you are not merely a navigator — you are the seed of the next galaxy.",
    hardConstraints: [
      "the player is never in physical danger — the Thalassa protects them",
      "the Architects are never shown alive, only through their biological records",
      "all technology is organic, never mechanical",
    ],
  },
  arcs: [
    {
      chapter: "w1",
      arcSummary: "A journey from the cellular foundations of life through genetics, evolution, ecology, and physiology, culminating in the biochemical engines that power it all — each world a living chapter of the Codex Vitae.",
      beats: [
        { topicId: "w1-cell-biology", role: "opening" as const, beat: "The Thalassa's outer membrane world introduces the Symbiont to the building blocks of life.", emotionalTarget: "wonder", connectsTo: ["w1-genetics"] },
        { topicId: "w1-genetics", role: "rising-action" as const, beat: "The code that writes all living things — DNA reveals the Architects' blueprint language.", emotionalTarget: "curiosity", connectsTo: ["w1-evolution", "w1-cell-biology"] },
        { topicId: "w1-evolution", role: "complication" as const, beat: "Life doesn't stay still — the galaxy itself has been evolving, and some paths lead to dead ends.", emotionalTarget: "tension", connectsTo: ["w1-genetics", "w1-ecology"] },
        { topicId: "w1-ecology", role: "midpoint" as const, beat: "Every system connects to every other — the web of life mirrors the web of the galaxy.", emotionalTarget: "insight", connectsTo: ["w1-evolution", "w1-plant-biology"] },
        { topicId: "w1-physiology", role: "deepening" as const, beat: "The Thalassa's own body systems mirror what you find — you begin to understand yourself.", emotionalTarget: "recognition", connectsTo: ["w1-cell-biology", "w1-biochemistry"] },
        { topicId: "w1-plant-biology", role: "rising-action" as const, beat: "The green worlds show how energy enters the living galaxy — the producers that sustain everything.", emotionalTarget: "appreciation", connectsTo: ["w1-ecology", "w1-biochemistry"] },
        { topicId: "w1-microbiology", role: "complication" as const, beat: "The smallest organisms prove the most dangerous — and the most essential.", emotionalTarget: "surprise", connectsTo: ["w1-physiology", "w1-evolution"] },
        { topicId: "w1-biochemistry", role: "climax" as const, beat: "At the molecular heart of life, the Codex reveals the engine that powers every living thing.", emotionalTarget: "awe", connectsTo: ["w1-cell-biology", "w1-physiology"] },
        { topicId: "w1-marine-biology", role: "resolution" as const, beat: "The oceanic depths hold the oldest memories — where life began, and where the Thalassa was first grown.", emotionalTarget: "reverence", connectsTo: ["w1-ecology", "w1-evolution"] },
      ],
      chapterHook: "The Thalassa shudders awake. Bioluminescent veins pulse along its walls — the first Codex fragment has been detected.",
    },
  ],
};

// ─── Count playable bodies ───────────────────────────────────────────

const playableBodies = bodies.filter(
  (b) => b.kind === "moon" || b.kind === "asteroid",
).length;

// ─── Assemble the raw Galaxy object ──────────────────────────────────

const raw = {
  meta: {
    id: "b2c3d4e5-f6a7-4890-9bcd-234567890bcd",
    schemaVersion: 2,
    createdAt: now - 20000,
    updatedAt: now,
    title: "Introduction to Biology (fixture)",
    chapters: [
      {
        id: "w1",
        uploadedAt: now - 20000,
        filename: "biology-notes.txt",
        addedKnowledgeIds: allKnowledgeIds,
        addedBodyIds: allBodyIds,
      },
    ],
  },

  source: {
    chapters: [
      {
        id: "w1",
        kind: "text",
        filename: "biology-notes.txt",
        byteSize: 9000,
        charCount: 9000,
        contentHash: "fixture-sha256-biology-000000000000000000000000000000000000000000",
        excerpt: "The cell is the basic structural and functional unit of all living organisms...",
        units: sourceUnits,
      },
    ],
  },

  knowledge: {
    title: "Introduction to Biology",
    summary: "A comprehensive survey of biology from cells to ecosystems, genetics to biochemistry.",
    topics: knowledgeTopics,
    subtopics: knowledgeSubtopics,
    concepts: knowledgeConcepts,
    looseConceptIds: LOOSE_CONCEPTS.map((c) => c.id),
  },

  detail,
  relationships: rels,
  narrative,

  spatial: {
    bounds: { minX: Math.round(-totalWidth / 2 - 400), minY: -400, maxX: Math.round(totalWidth / 2 + 400), maxY: 400 },
    bodies,
  },

  visuals: vis,
  scenes: {},
  conversations: {},

  progress: {
    bodies: {},
    totalBodies: playableBodies,
    visitedCount: 0,
    completedCount: 0,
    overallMastery: 0,
  },

  pipeline: {
    ingest:        { status: "done", progress: 1, startedAt: now - 20000, finishedAt: now - 19500, error: null },
    structure:     { status: "done", progress: 1, startedAt: now - 19500, finishedAt: now - 17000, error: null },
    detail:        { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 12000, error: null },
    coverageAudit: { status: "done", progress: 1, startedAt: now - 12000, finishedAt: now - 11500, error: null },
    narrative:     { status: "done", progress: 1, startedAt: now - 11500, finishedAt: now - 10000, error: null },
    layout:        { status: "done", progress: 1, startedAt: now - 17000, finishedAt: now - 16000, error: null },
    visuals:       { status: "done", progress: 1, startedAt: now - 10000, finishedAt: now - 8000, error: null },
  },
};

// Parse at import time — fails loudly if the fixture drifts from the schema.
export const sampleGalaxy = Galaxy.parse(raw);
