import Editor, { DiffEditor, Monaco, OnMount } from '@monaco-editor/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Command, Loader2 } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { editor as monacoEditor } from 'monaco-editor'
import { useCompletion } from 'ai/react'
import { detectOS } from 'lib/helpers'
import { constructHeaders } from 'data/fetchers'
import { toast } from 'sonner'
import InlineWidget from 'components/interfaces/SQLEditor/InlineWidget'
import { AskAIWidget } from 'components/interfaces/SQLEditor/AskAIWidget'

interface AIEditorProps {
  id?: string
  language?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  aiEndpoint?: string
  aiMetadata?: {
    projectRef?: string
    connectionString?: string
    includeSchemaMetadata?: boolean
  }
  initialPrompt?: string
  readOnly?: boolean
  className?: string
  options?: monacoEditor.IStandaloneEditorConstructionOptions
}

const AIEditor = ({
  id,
  language = 'javascript',
  value,
  defaultValue = '',
  onChange,
  aiEndpoint,
  aiMetadata,
  initialPrompt,
  readOnly = false,
  className = '',
  options = {},
}: AIEditorProps) => {
  const os = detectOS()
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null)
  const diffEditorRef = useRef<monacoEditor.IStandaloneDiffEditor | null>(null)

  const [currentValue, setCurrentValue] = useState(value || defaultValue)
  const [isDiffMode, setIsDiffMode] = useState(false)
  const [isDiffEditorMounted, setIsDiffEditorMounted] = useState(false)
  const [diffValue, setDiffValue] = useState({ original: '', modified: '' })
  const [promptState, setPromptState] = useState({
    isOpen: Boolean(initialPrompt),
    selection: '',
    beforeSelection: '',
    afterSelection: '',
    startLineNumber: 0,
    endLineNumber: 0,
  })
  const [promptInput, setPromptInput] = useState(initialPrompt || '')

  useEffect(() => {
    setCurrentValue(value || defaultValue)
  }, [value, defaultValue])

  useEffect(() => {
    if (!isDiffMode) {
      setIsDiffEditorMounted(false)
    }
  }, [isDiffMode])

  const {
    complete,
    completion,
    isLoading: isCompletionLoading,
    setCompletion,
  } = useCompletion({
    api: aiEndpoint || '',
    body: aiMetadata,
    onResponse: (response) => {
      if (!response.ok) throw new Error('Failed to generate completion')
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`)
    },
  })

  useEffect(() => {
    if (!completion) {
      setIsDiffMode(false)
      return
    }

    const original =
      promptState.beforeSelection + promptState.selection + promptState.afterSelection
    const modified = promptState.beforeSelection + completion + promptState.afterSelection

    setDiffValue({ original, modified })
    setIsDiffMode(true)
  }, [completion, promptState.beforeSelection, promptState.selection, promptState.afterSelection])

  const handleReset = () => {
    setCompletion('')
    setIsDiffMode(false)
    setPromptState((prev) => ({ ...prev, isOpen: false }))
    setPromptInput('')
    editorRef.current?.focus()
  }

  const handleAcceptDiff = () => {
    if (diffValue.modified) {
      const newValue = diffValue.modified
      setCurrentValue(newValue)
      onChange?.(newValue)
      handleReset()
    }
  }

  const handleRejectDiff = () => {
    handleReset()
  }

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleReset()
      } else if (
        event.key === 'Enter' &&
        (os === 'macos' ? event.metaKey : event.ctrlKey) &&
        isDiffMode
      ) {
        handleAcceptDiff()
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [os, isDiffMode])

  const handleEditorDidMount: OnMount = (
    editor: monacoEditor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor

    // Set prompt state to open if promptInput exists
    if (promptInput) {
      const model = editor.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        setPromptState({
          isOpen: true,
          selection: model.getValue(),
          beforeSelection: '',
          afterSelection: '',
          startLineNumber: 1,
          endLineNumber: lineCount,
        })
      }
    }

    editor.addAction({
      id: 'generate-ai',
      label: 'Generate with AI',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: () => {
        const selection = editor.getSelection()
        const model = editor.getModel()
        if (!model || !selection) return

        const allLines = model.getLinesContent()
        const startLineIndex = selection.startLineNumber - 1
        const endLineIndex = selection.endLineNumber

        const beforeSelection = allLines.slice(0, startLineIndex).join('\n') + '\n'
        const selectedText = allLines.slice(startLineIndex, endLineIndex).join('\n')
        const afterSelection = '\n' + allLines.slice(endLineIndex).join('\n')

        setPromptState({
          isOpen: true,
          selection: selectedText,
          beforeSelection,
          afterSelection,
          startLineNumber: selection?.startLineNumber ?? 0,
          endLineNumber: selection?.endLineNumber ?? 0,
        })
      },
    })
  }

  const handlePrompt = async (
    prompt: string,
    context: {
      beforeSelection: string
      selection: string
      afterSelection: string
    }
  ) => {
    try {
      setPromptState((prev) => ({
        ...prev,
        selection: context.selection,
        beforeSelection: context.beforeSelection,
        afterSelection: context.afterSelection,
      }))

      const headerData = await constructHeaders()
      await complete(prompt, {
        headers: { Authorization: headerData.get('Authorization') ?? '' },
        body: {
          ...aiMetadata,
          completionMetadata: {
            textBeforeCursor: context.beforeSelection,
            textAfterCursor: context.afterSelection,
            language,
            prompt,
            selection: context.selection,
          },
        },
      })
    } catch (error) {
      setPromptState((prev) => ({ ...prev, isOpen: false }))
    }
  }

  const defaultOptions: monacoEditor.IStandaloneEditorConstructionOptions = {
    tabSize: 2,
    fontSize: 13,
    readOnly,
    minimap: { enabled: false },
    wordWrap: 'on',
    lineNumbers: 'on',
    folding: false,
    padding: { top: 4 },
    lineNumbersMinChars: 3,
    ...options,
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full relative">
      {isDiffMode ? (
        <div className="w-full h-full">
          <DiffEditor
            theme="vs-dark"
            language={language}
            original={diffValue.original}
            modified={diffValue.modified}
            onMount={(editor) => {
              diffEditorRef.current = editor as monacoEditor.IStandaloneDiffEditor
              setIsDiffEditorMounted(true)
            }}
            options={{
              ...defaultOptions,
              renderSideBySide: false,
            }}
          />
          {isDiffEditorMounted && (
            <InlineWidget
              editor={diffEditorRef.current!}
              id="ask-ai-diff"
              heightInLines={3}
              afterLineNumber={0}
              beforeLineNumber={Math.max(0, promptState.startLineNumber - 1)}
            >
              <AskAIWidget
                onSubmit={(prompt: string) => {
                  handlePrompt(prompt, {
                    beforeSelection: promptState.beforeSelection,
                    selection: promptState.selection || diffValue.modified,
                    afterSelection: promptState.afterSelection,
                  })
                }}
                value={promptInput}
                onChange={setPromptInput}
                onAccept={handleAcceptDiff}
                onReject={handleRejectDiff}
                isDiffVisible={true}
                isLoading={isCompletionLoading}
              />
            </InlineWidget>
          )}
        </div>
      ) : (
        <div className="w-full h-full relative">
          <Editor
            theme="vs-dark"
            language={language}
            value={currentValue}
            options={defaultOptions}
            onChange={(value: string | undefined) => {
              const newValue = value || ''
              setCurrentValue(newValue)
              onChange?.(newValue)
            }}
            onMount={handleEditorDidMount}
            className={className}
          />
          {promptState.isOpen && editorRef.current && (
            <InlineWidget
              editor={editorRef.current}
              id="ask-ai"
              afterLineNumber={promptState.endLineNumber}
              beforeLineNumber={Math.max(0, promptState.startLineNumber - 1)}
              heightInLines={2}
            >
              <AskAIWidget
                value={promptInput}
                onChange={setPromptInput}
                onSubmit={(prompt: string) => {
                  handlePrompt(prompt, {
                    beforeSelection: promptState.beforeSelection,
                    selection: promptState.selection,
                    afterSelection: promptState.afterSelection,
                  })
                }}
                isDiffVisible={false}
                isLoading={isCompletionLoading}
              />
            </InlineWidget>
          )}
          <AnimatePresence>
            {!promptState.isOpen && !currentValue && aiEndpoint && (
              <motion.p
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 5, opacity: 0 }}
                className="text-foreground-lighter absolute bottom-4 left-4 z-10 font-mono text-xs flex items-center gap-1"
              >
                Hit {os === 'macos' ? <Command size={12} /> : `CTRL+`}K to edit with the Assistant
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default AIEditor
