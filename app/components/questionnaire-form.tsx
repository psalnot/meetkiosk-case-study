import { useState, useEffect } from "react";
import { QuestionNode } from "~/utils/questions/types";
import { Answer } from "~/utils/matching/types.server";

// Simplified docx imports
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';

// But keep the file-saver fix
import FileSaver from 'file-saver';
const { saveAs } = FileSaver;

export interface QuestionnaireFormData {
  declarationDate: string;
  questionTree: QuestionNode[];
  answers: Record<string, Answer>;
}

/**
 * Renders the complete CSRD compliance questionnaire with computed answers.
 */
export default function QuestionnaireForm({ data }: {  QuestionnaireFormData }) {
  const { declarationDate, questionTree, answers: initialAnswers } = data; // ✅ Rename to initialAnswers

  // ✅ Declare all required state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [manualAnswerChanges, setManualAnswerChanges] = useState<Record<string, { value: string; explanation: string }>>({});

  // Initialize all sections as collapsed by default
  useEffect(() => {
    const initialCollapsed: Record<string, boolean> = {};
    setCollapsedSections(initialCollapsed);
  }, []);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const isSectionCollapsed = (sectionId: string) => {
    return collapsedSections[sectionId] ?? true; // Default to collapsed
  };

  // Get current answer value (prioritize user changes over initial answers)
  const getCurrentAnswer = (questionId: string): Answer => {
    const initialAnswer = initialAnswers[questionId];
    if (!initialAnswer) return { value: null, source: "manual", explanation: "" };
    
    if (initialAnswer.source === "computed") {
      return initialAnswer;
    }
    
    const userChange = manualAnswerChanges[questionId];
    if (userChange) {
      return {
        value: userChange.value || null,
        explanation: userChange.explanation,
        source: "manual"
      };
    }
    
    return initialAnswer;
  };

  // Handle manual answer changes
  const handleManualAnswerChange = (questionId: string, field: 'value' | 'explanation', value: string) => {
    setManualAnswerChanges(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value
      }
    }));
  };

  const exportToWord = async () => {
    console.log("🚀 Starting structured Word export...");
    
    try {
      const paragraphs = [];
      
      // Title
      paragraphs.push(new Paragraph({
        text: "CSRD Compliance Report",
        heading: HeadingLevel.TITLE,
      }));
      
      // Declaration date
      paragraphs.push(new Paragraph({
        text: `Declaration Date: ${declarationDate}`,
        heading: HeadingLevel.HEADING_2,
      }));
      
      // Helper function to extract dynamic table data
      const extractDynamicTableData = (tableNode: QuestionNode, answers: Record<string, Answer>) => {
        const tableAnswerKeys = Object.keys(answers).filter(key => {
          return tableNode.children.some(child => key.startsWith(child.id + '_'));
        });

        if (tableAnswerKeys.length === 0) {
          return null;
        }

        if (tableNode.id === "S1-6_07") {
          const dimensions = new Set<string>();
          const groupedAnswers: Record<string, Record<string, Answer>> = {};

          tableAnswerKeys.forEach(key => {
            const parts = key.split('_');
            if (parts.length >= 4) {
              const dimension = `${parts[2]}_${parts[3]}`;
              dimensions.add(dimension);
              if (!groupedAnswers[dimension]) {
                groupedAnswers[dimension] = {};
              }
              groupedAnswers[dimension][`${parts[0]}_${parts[1]}`] = answers[key];
            }
          });

          return { dimensions: Array.from(dimensions), groupedAnswers, type: 'contract_gender' };
        }

        const dimensions = new Set<string>();
        const groupedAnswers: Record<string, Record<string, Answer>> = {};

        tableAnswerKeys.forEach(key => {
          const parts = key.split('_');
          const baseId = parts.slice(0, -1).join('_');
          const dimension = parts[parts.length - 1];
          dimensions.add(dimension);
          if (!groupedAnswers[dimension]) {
            groupedAnswers[dimension] = {};
          }
          groupedAnswers[dimension][baseId] = answers[key];
        });

        return { dimensions: Array.from(dimensions), groupedAnswers, type: 'standard' };
      };

      const buildDocumentStructure = (nodes: QuestionNode[], depth: number = 0): Paragraph[] => {
        let content: Paragraph[] = [];
        
        nodes.forEach(node => {
          if (node.content === "") {
            content.push(new Paragraph({
              text: `${node.id} - ${node.labelEn}`,
              heading: depth === 0 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            }));
            
            if (node.children?.length) {
              content = content.concat(buildDocumentStructure(node.children, depth + 1));
            }
          }
          else if (node.content === "Table") {
            content.push(new Paragraph({
              text: `${node.id} - ${node.labelEn}`,
              heading: HeadingLevel.HEADING_3,
            }));
            
            const hasStaticAnswers = node.children.some(child => initialAnswers[child.id] !== undefined);
            const hasDynamicAnswers = Object.keys(initialAnswers).some(key => 
              node.children.some(child => key.startsWith(child.id + '_'))
            );
            
            if (hasStaticAnswers && !hasDynamicAnswers) {
              node.children.forEach(child => {
                const answer = getCurrentAnswer(child.id); // ✅ Use getCurrentAnswer
                if (!answer) return;
                
                content.push(new Paragraph({
                  text: `${child.id} - ${child.labelEn}`,
                  heading: HeadingLevel.HEADING_4,
                }));
                
                content.push(new Paragraph({
                  children: [new TextRun({
                    text: `Value: ${answer.value ?? 'Not provided'}`,
                    bold: true,
                  })],
                }));
                
                if (answer.explanation) {
                  content.push(new Paragraph({
                    text: `Explanation: ${answer.explanation}`,
                    italics: true,
                  }));
                }
              });
            }
            else if (hasDynamicAnswers) {
              const tableData = extractDynamicTableData(node, initialAnswers);
              if (tableData) {
                tableData.dimensions.forEach(dimension => {
                  const dimensionLabel = 
                    node.id === "S1-6_04" ? `Country: ${dimension}` :
                    node.id === "S1-6_08" ? `Region: ${dimension}` :
                    node.id === "S1-6_18" ? `Category: ${dimension}` :
                    `Contract Gender: ${dimension}`;
                  
                  content.push(new Paragraph({
                    text: dimensionLabel,
                    bold: true,
                  }));
                  
                  node.children.forEach(child => {
                    const answerKey = `${child.id}_${dimension}`;
                    const answer = getCurrentAnswer(answerKey); // ✅ Use getCurrentAnswer
                    if (!answer) return;
                    
                    content.push(new Paragraph({
                      text: `${child.id} - ${child.labelEn}`,
                      heading: HeadingLevel.HEADING_4,
                    }));
                    
                    content.push(new Paragraph({
                      children: [new TextRun({
                        text: `Value: ${answer.value ?? 'Not provided'}`,
                        bold: true,
                      })],
                    }));
                    
                    if (answer.explanation) {
                      content.push(new Paragraph({
                        text: `Explanation: ${answer.explanation}`,
                        italics: true,
                      }));
                    }
                  });
                });
              }
            }
          }
          else {
            const answer = getCurrentAnswer(node.id); // ✅ Use getCurrentAnswer
            if (!answer) return;
            
            content.push(new Paragraph({
              text: `${node.id} - ${node.labelEn}`,
              heading: HeadingLevel.HEADING_3,
            }));
            
            content.push(new Paragraph({
              children: [new TextRun({
                text: `Value: ${answer.value ?? 'Not provided'}`,
                bold: true,
              })],
            }));
            
            if (answer.explanation) {
              content.push(new Paragraph({
                text: `Explanation: ${answer.explanation}`,
                italics: true,
              }));
            }
          }
          
          if (depth === 0) {
            content.push(new Paragraph(""));
          }
        });
        
        return content;
      };
      
      const documentContent = buildDocumentStructure(questionTree);
      paragraphs.push(...documentContent);
      
      console.log("📝 Document structure built with", paragraphs.length, "paragraphs");
      
      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, "csrd-compliance-report.docx");
      
      console.log("🎉 Structured export completed successfully!");
      
    } catch (error) {
      console.error("❌ Export failed:", error);
      alert("Export failed: " + (error as Error).message);
    }
  };

  return (
    <div className="page">
      <div className="form-header">
        <h1 className="title">CSRD Compliance Report</h1>
        <span className="period-badge">Declaration Date: {declarationDate}</span>
      </div>

      <div className="questions-list">
        <QuestionTree 
          nodes={questionTree} 
          answers={initialAnswers}
          getCurrentAnswer={getCurrentAnswer}
          onManualAnswerChange={handleManualAnswerChange}
          collapsedSections={collapsedSections}
          onToggleSection={toggleSection}
          isSectionCollapsed={isSectionCollapsed}
        />
      </div>

      <div className="form-actions">
        
        <button
          type="button"
          onClick={exportToWord}
          className="button button-primary"
        >
          Export to Word (.docx)
        </button>
      </div>
    </div>
  );
}

/**
 * Recursively renders question nodes with hierarchical indentation.
 */
function QuestionTree({ 
  nodes, 
  answers,
  getCurrentAnswer,
  onManualAnswerChange,
  collapsedSections,
  onToggleSection,
  isSectionCollapsed,
  depth = 0 
}: { 
  nodes: QuestionNode[]; 
  answers: Record<string, Answer>;
  getCurrentAnswer: (id: string) => Answer;
  onManualAnswerChange: (questionId: string, field: 'value' | 'explanation', value: string) => void;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  depth?: number;
}) {
  if (!nodes || !Array.isArray(nodes)) {
    return null;
  }

  return (
    <>
      {nodes.map((node) => (
        <QuestionNodeRenderer 
          key={node.id} 
          node={node} 
          answers={answers}
          getCurrentAnswer={getCurrentAnswer}
          onManualAnswerChange={onManualAnswerChange}
          collapsedSections={collapsedSections}
          onToggleSection={onToggleSection}
          isSectionCollapsed={isSectionCollapsed}
          depth={depth}
        />
      ))}
    </>
  );
}

/**
 * Renders a single question node with proper hierarchy styling.
 */
function QuestionNodeRenderer({ 
  node, 
  answers,
  getCurrentAnswer,
  onManualAnswerChange,
  collapsedSections,
  onToggleSection,
  isSectionCollapsed,
  depth 
}: { 
  node: QuestionNode; 
  answers: Record<string, Answer>;
  getCurrentAnswer: (id: string) => Answer;
  onManualAnswerChange: (questionId: string, field: 'value' | 'explanation', value: string) => void;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  depth: number;
}) {
  console.log("Rendering node:", node.id, "Content:", node.content, "Children:", node.children?.length);

  if (node.content === "") {
    const isCollapsed = isSectionCollapsed(node.id);
    console.log("Rendering as SECTION:", node.id);
    
    return (
      <div className="question-section" style={{ marginLeft: `${depth * 20}px` }}>
        <div 
          className="section-header clickable"
          onClick={() => onToggleSection(node.id)}
        >
          <span className="toggle-icon">
            {isCollapsed ? '+' : '−'}
          </span>
          <h2 className="section-title">{node.id} - {node.labelEn}</h2>
        </div>
        
        {!isCollapsed && node.children && node.children.length > 0 && (
          <div className="section-children">
            <QuestionTree 
              nodes={node.children} 
              answers={answers}
              getCurrentAnswer={getCurrentAnswer}
              onManualAnswerChange={onManualAnswerChange}
              collapsedSections={collapsedSections}
              onToggleSection={onToggleSection}
              isSectionCollapsed={isSectionCollapsed}
              depth={depth + 1} 
            />
          </div>
        )}
      </div>
    );
  }

  if (node.content === "Table") {
    const hasStaticAnswers = node.children.some(child => answers[child.id] !== undefined);
    const hasDynamicAnswers = Object.keys(answers).some(key => 
      node.children.some(child => key.startsWith(child.id + '_'))
    );

    const isCollapsed = isSectionCollapsed(node.id);

    if (hasStaticAnswers && !hasDynamicAnswers) {
      return (
        <div className="question-table-container" style={{ marginLeft: `${depth * 20}px` }}>
          <div 
            className="table-header clickable"
            onClick={() => onToggleSection(node.id)}
          >
            <span className="toggle-icon">
              {isCollapsed ? '+' : '−'}
            </span>
            <h3 className="table-title">{node.id} - {node.labelEn}</h3>
          </div>
          
          {!isCollapsed && node.children && node.children.length > 0 && (
            <div className="table-children">
              <QuestionTree 
                nodes={node.children} 
                answers={answers}
                getCurrentAnswer={getCurrentAnswer}
                onManualAnswerChange={onManualAnswerChange}
                collapsedSections={collapsedSections}
                onToggleSection={onToggleSection}
                isSectionCollapsed={isSectionCollapsed}
                depth={depth + 1} 
              />
            </div>
          )}
        </div>
      );
    } else if (hasDynamicAnswers) {
      return (
        <div className="question-table-container" style={{ marginLeft: `${depth * 20}px` }}>
          <div 
            className="table-header clickable"
            onClick={() => onToggleSection(node.id)}
          >
            <span className="toggle-icon">
              {isCollapsed ? '+' : '−'}
            </span>
            <h3 className="table-title">{node.id} - {node.labelEn}</h3>
          </div>
          
          {!isCollapsed && (
            <DynamicTableRows 
              tableNode={node} 
              answers={answers}
              getCurrentAnswer={getCurrentAnswer}
              onManualAnswerChange={onManualAnswerChange}
              depth={depth + 1}
            />
          )}
        </div>
      );
    }
    
    return (
      <div className="question-table-container" style={{ marginLeft: `${depth * 20}px` }}>
        <div 
          className="table-header clickable"
          onClick={() => onToggleSection(node.id)}
        >
          <span className="toggle-icon">+</span>
          <h3 className="table-title">{node.id} - {node.labelEn}</h3>
        </div>
        {!isCollapsed && <p className="no-data">No data available</p>}
      </div>
    );
  }

  const answer = getCurrentAnswer(node.id);
  const isManual = answer.source === "manual";
  console.log("Rendering as REGULAR QUESTION:", node.id, "Has answer:", !!answer);
  if (!answer) return null;

  return (
    <div className="question-field" style={{ marginLeft: `${depth * 20}px` }}>
      <QuestionField 
        question={node} 
        answer={answer}
        onManualChange={isManual ? (field, value) => 
          onManualAnswerChange(node.id, field, value) 
        : undefined}
      />
    </div>
  );
}

/**
 * Dynamically renders table rows based on actual answer keys.
 */
function DynamicTableRows({
  tableNode,
  answers,
  getCurrentAnswer,
  onManualAnswerChange,
  depth
}: {
  tableNode: QuestionNode;
  answers: Record<string, Answer>;
  getCurrentAnswer: (id: string) => Answer;
  onManualAnswerChange: (questionId: string, field: 'value' | 'explanation', value: string) => void;
  depth: number;
}) {
  const tableAnswerKeys = Object.keys(answers).filter(key => {
    return tableNode.children.some(child => key.startsWith(child.id + '_'));
  });

  if (tableAnswerKeys.length === 0) {
    return <p className="no-data">No data available</p>;
  }

  if (tableNode.id === "S1-6_07") {
    const dimensions = new Set<string>();
    const groupedAnswers: Record<string, Record<string, Answer>> = {};

    tableAnswerKeys.forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 4) {
        const dimension = `${parts[2]}_${parts[3]}`;
        dimensions.add(dimension);
        if (!groupedAnswers[dimension]) {
          groupedAnswers[dimension] = {};
        }
        groupedAnswers[dimension][`${parts[0]}_${parts[1]}`] = answers[key];
      }
    });

    return (
      <div className="dynamic-table">
        {Array.from(dimensions).map(dimension => (
          <div key={dimension} className="table-row" style={{ marginLeft: `${depth * 20}px` }}>
            <div className="dimension-header">
              <strong>Contract Gender: {dimension}</strong>
            </div>
            {tableNode.children.map(child => {
              const answerKey = `${child.id}_${dimension}`;
              const answer = getCurrentAnswer(answerKey);
              
              if (!answer) return null;
              
              return (
                <div key={answerKey} className="table-cell" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                  <QuestionField 
                    question={child} 
                    answer={answer}
                    onManualChange={answer.source === "manual" ? (field, value) => 
                      onManualAnswerChange(answerKey, field, value) 
                    : undefined}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const dimensions = new Set<string>();
  const groupedAnswers: Record<string, Record<string, Answer>> = {};

  tableAnswerKeys.forEach(key => {
    const parts = key.split('_');
    const baseId = parts.slice(0, -1).join('_');
    const dimension = parts[parts.length - 1];
    dimensions.add(dimension);
    if (!groupedAnswers[dimension]) {
      groupedAnswers[dimension] = {};
    }
    groupedAnswers[dimension][baseId] = answers[key];
  });

  return (
    <div className="dynamic-table">
      {Array.from(dimensions).map(dimension => (
        <div key={dimension} className="table-row" style={{ marginLeft: `${depth * 20}px` }}>
          <div className="dimension-header">
            <strong>
              {tableNode.id === "S1-6_04" ? "Country: " : 
               tableNode.id === "S1-6_08" ? "Region: " :
               tableNode.id === "S1-6_18" ? "Category: " :
               "Contract Gender: "}{dimension}
            </strong>
          </div>

          {tableNode.children.map(child => {
            const answerKey = `${child.id}_${dimension}`;
            const answer = getCurrentAnswer(answerKey);
            
            if (!answer) return null;
            
            return (
              <div key={answerKey} className="table-cell" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
                <QuestionField 
                  question={child} 
                  answer={answer}
                  onManualChange={answer.source === "manual" ? (field, value) => 
                    onManualAnswerChange(answerKey, field, value) 
                  : undefined}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a single question field with ID + Label, source badge, and explanation.
 */
function QuestionField({ 
  question, 
  answer,
  onManualChange 
}: { 
  question: QuestionNode; 
  answer: Answer;
  onManualChange?: (field: 'value' | 'explanation', value: string) => void; 
}) {
  const currentValue = answer.value?.toString() || "";
  const currentExplanation = answer.explanation || "";

  return (
    <div className="question-field-content">
      <div className="question-header">
        <div>
          <h3 className="question-label">{question.id} - {question.labelEn}</h3>
        </div>
        <span className={`source-badge ${answer.source === "computed" ? "computed" : "manual"}`}>
          {answer.source === "computed" ? "Auto-computed" : "Manual"}
        </span>
      </div>

      {answer.source === "computed" ? (
        <div className="computed-answer">
          <input
            type="text"
            value={currentValue}
            readOnly
            className="input input-computed"
            title={currentExplanation}
          />
          {currentExplanation && (
            <p className="explanation">
              {currentExplanation}
            </p>
          )}
        </div>
      ) : (
        <div className="manual-input">
          {question.content === "enum" ? (
            <select 
              value={currentValue}
              onChange={(e) => onManualChange?.('value', e.target.value)}
              className="input"
            >
              <option value="">Select an option...</option>
              {question.enumEn?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              value={currentValue}
              onChange={(e) => onManualChange?.('value', e.target.value)}
              rows={3}
              className="input input-textarea"
              placeholder="Enter your response..."
            />
          )}
          
          {onManualChange && (
            <textarea
              value={currentExplanation}
              onChange={(e) => onManualChange?.('explanation', e.target.value)}
              rows={2}
              className="input input-textarea"
              placeholder="Enter explanation..."
              style={{ marginTop: '8px' }}
            />
          )}
        </div>
      )}
    </div>
  );
}