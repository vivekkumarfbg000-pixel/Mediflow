import { supabase } from '../lib/supabaseClient';
import { load, save, writeAuditLog, notify } from './apiHelper';

export interface AIResult {
  id: string;
  user_id: string;
  task_id: string;
  patient_id: string;
  input_data: string;
  output_data: string;
  output_type: 'HINGLISH_SUMMARY' | 'RAG_CLINICAL_ADVISORY' | 'COMPARATIVE_TREND';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  error_details?: string;
  created_at: string;
  model_used: string;
  duration_ms: number;
}

export class AIService {
  static getAIResults(patientId?: string): AIResult[] {
    const results = load<AIResult[]>('ai_results', []);
    if (patientId) {
      return results
        .filter(r => r.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return results;
  }

  static getAIResultByTaskId(taskId: string): AIResult | null {
    const results = load<AIResult[]>('ai_results', []);
    return results.find(r => r.task_id === taskId) || null;
  }

  static async saveAIResult(result: AIResult): Promise<void> {
    const results = load<AIResult[]>('ai_results', []);
    const index = results.findIndex(r => r.id === result.id || (result.task_id && r.task_id === result.task_id));
    if (index !== -1) {
      results[index] = result;
    } else {
      results.push(result);
    }
    save('ai_results', results);
    notify();

    try {
      const { error } = await supabase.from('ai_results').insert({
        id: result.id,
        user_id: result.user_id,
        task_id: result.task_id,
        patient_id: result.patient_id,
        input_data: result.input_data,
        output_data: result.output_data,
        output_type: result.output_type,
        status: result.status,
        error_details: result.error_details || null,
        created_at: result.created_at,
        model_used: result.model_used,
        duration_ms: result.duration_ms
      });
      if (error) {
        console.warn('[AIService] DB insert warning (non-fatal):', error.message);
      } else {
        await writeAuditLog('AI_RESULT_PERSISTED', { 
          taskId: result.task_id, 
          outputType: result.output_type 
        }, result.patient_id);
      }
    } catch (e) {
      console.debug('[AIService] DB offline or table missing (non-fatal):', e);
    }
  }
}
