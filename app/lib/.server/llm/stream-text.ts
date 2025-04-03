import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { getFilePaths } from './select-context';

export type Messages = Message[];
// Batch size for chunking responses - helps to smooth out streaming
const STREAM_BATCH_INTERVAL = 80; // milliseconds
const STREAM_BATCH_SIZE = 120; // characters
export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
  onFinish?: (props: {
    text: string;
    finishReason?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    reasoning?: string;
  }) => void | Promise<void>;

  // New option to control response smoothing
  smoothStreaming?: boolean;
}

// Function to sanitize reasoning output to prevent XML/tag related errors
export function sanitizeReasoningOutput(content: string): string {
  try {
    // Remove or escape problematic tags that might cause rendering issues
    let sanitized = content;

    // Convert actual XML tags to safe HTML entities
    sanitized = sanitized.replace(/<(\/?)think>/g, '&lt;$1think&gt;');

    // Ensure any incomplete tags are properly closed or removed
    const openTags = (sanitized.match(/<[^/>][^>]*>/g) || []).length;
    const closeTags = (sanitized.match(/<\/[^>]+>/g) || []).length;

    if (openTags > closeTags) {
      // We have unclosed tags - simplest approach is to wrap in a safe format
      sanitized = `<div class="__boltThought__">${sanitized}</div>`;
    }

    return sanitized;
  } catch (error) {
    logger.error('Error sanitizing reasoning output:', error);

    // Return a safe version if sanitization fails
    return content;
  }
}
/**
 * Optimize context buffer when it's too large
 * This reduces the token count for very large context windows
 */
function optimizeContextBuffer(context: string, maxLength: number = 100000): string {
  if (context.length <= maxLength) {
    return context;
  }

  // If context is too large, keep the start and end but trim the middle
  const halfMax = Math.floor(maxLength / 2);

  return (
    context.substring(0, halfMax) +
    `\n\n... [Context truncated to reduce size] ...\n\n` +
    context.substring(context.length - halfMax)
  );
}

const logger = createScopedLogger('stream-text');

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();
// Use reasoning prompt for models that support reasoning when no specific prompt is requested
if (!promptId && modelDetails?.features?.reasoning) {
  systemPrompt =
    PromptLibrary.getPropmtFromLibrary('reasoning', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? systemPrompt; // Fall back to the existing system prompt if reasoning prompt fails
}

  if (files && contextFiles && contextOptimization) {
    // Optimization: Only create context if there are files
    if (Object.keys(contextFiles).length > 0) {
      const codeContext = createFilesContext(contextFiles, true);
      const filePaths = getFilePaths(files);

 // Optimize context buffer if it's too large
 const optimizedCodeContext = optimizeContextBuffer(codeContext);

 systemPrompt = `${systemPrompt}Below are all the files present in the project:
---
${filePaths.join('\n')}
---

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
CONTEXT BUFFER:
---
${optimizedCodeContext}
---
`;
}
    if (summary) {
        // Optimize summary if it's too long
        const optimizedSummary =
        summary.length > 10000
          ? summary.substring(0, 5000) + '\n[Summary truncated...]\n' + summary.substring(summary.length - 5000)
          : summary;
      systemPrompt = `${systemPrompt}
below is the chat history till now
CHAT SUMMARY:
---
${optimizedSummary}
---
`;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name}`);

  // console.log(systemPrompt,processedMessages);

//   return await _streamText({
//     model: provider.getModelInstance({
//       model: modelDetails.name,
//       serverEnv,
//       apiKeys,
//       providerSettings,
//     }),
//     system: systemPrompt,
//     maxTokens: dynamicMaxTokens,
//     messages: convertToCoreMessages(processedMessages as any),
//     ...options,
//   });
// }
 // Store original messages for reference
 const originalMessages = [...messages];
 const hasMultimodalContent = originalMessages.some((msg) => Array.isArray(msg.content));
 // Create enhanced options with streaming improvements
 const enhancedOptions = {
  ...options,

  // Add batch options for smoother streaming if requested
  ...(options?.smoothStreaming !== false && {
    streamingGranularity: 'character',
    streamBatchSize: STREAM_BATCH_SIZE,
    streamBatchInterval: STREAM_BATCH_INTERVAL,
  }),
};

 try {
   if (hasMultimodalContent) {
     /*
      * For multimodal content, we need to preserve the original array structure
      * but make sure the roles are valid and content items are properly formatted
      */
     const multimodalMessages = originalMessages.map((msg) => ({
       role: msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
       content: Array.isArray(msg.content)
         ? msg.content.map((item) => {
             // Ensure each content item has the correct format
             if (typeof item === 'string') {
               return { type: 'text', text: item };
             }

             if (item && typeof item === 'object') {
               if (item.type === 'image' && item.image) {
                 return { type: 'image', image: item.image };
               }

               if (item.type === 'text') {
                 return { type: 'text', text: item.text || '' };
               }
             }

             // Default fallback for unknown formats
             return { type: 'text', text: String(item || '') };
           })
         : [{ type: 'text', text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }],
     }));
// Get model with middleware applied
const llmManager = LLMManager.getInstance();
const model = llmManager.getModelInstance({
  model: modelDetails.name,
  provider: provider.name,
  serverEnv,
  apiKeys,
  providerSettings,
});
     return await _streamText({
      model,

       system: systemPrompt,
       maxTokens: dynamicMaxTokens,
       messages: multimodalMessages as any,
       ...enhancedOptions,
      });
   } else {
     // For non-multimodal content, we use the standard approach
     const normalizedTextMessages = processedMessages.map((msg) => ({
       role: msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
       content: typeof msg.content === 'string' ? msg.content : String(msg.content || ''),
     }));
// Get model with middleware applied
const llmManager = LLMManager.getInstance();
const model = llmManager.getModelInstance({
  model: modelDetails.name,
  provider: provider.name,
  serverEnv,
  apiKeys,
  providerSettings,
});
     return await _streamText({
      model,

       system: systemPrompt,
       maxTokens: dynamicMaxTokens,
       messages: convertToCoreMessages(normalizedTextMessages),
       ...enhancedOptions,
      });
   }
 } catch (error: any) {
   // Special handling for format errors
   if (error.message && error.message.includes('messages must be an array of CoreMessage or UIMessage')) {
     logger.warn('Message format error detected, attempting recovery with explicit formatting...');

     // Create properly formatted messages for all cases as a last resort
     const fallbackMessages = processedMessages.map((msg) => {
       // Determine text content with careful type handling
       let textContent = '';

       if (typeof msg.content === 'string') {
         textContent = msg.content;
       } else if (Array.isArray(msg.content)) {
         // Handle array content safely
         const contentArray = msg.content as any[];
         textContent = contentArray
           .map((contentItem) =>
             typeof contentItem === 'string'
               ? contentItem
               : contentItem?.text || contentItem?.image || String(contentItem || ''),
           )
           .join(' ');
       } else {
         textContent = String(msg.content || '');
       }

       return {
         role: msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user',
         content: [
           {
             type: 'text',
             text: textContent,
           },
         ],
       };
     });
     const fallbackModel = LLMManager.getInstance().getModelInstance({
      model: modelDetails.name,
      provider: provider.name,
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
    });
     // Try one more time with the fallback format
     return await _streamText({
      model: fallbackModel,

       system: systemPrompt,
       maxTokens: dynamicMaxTokens,
       messages: fallbackMessages as any,
       ...enhancedOptions,
      });
   }

   // If it's not a format error, re-throw the original error
   throw error;
 }
}
