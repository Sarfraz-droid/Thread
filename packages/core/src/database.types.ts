
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "conversations": {
                  Row: {
                    "created_at": string,"id": string,"summary": string,"title": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"summary"?: string,"title"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"summary"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"kind": string,"mime_type": string,"name": string,"path": string,"size": number,"text": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"kind": string,"mime_type": string,"name": string,"path": string,"size": number,"text"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"kind"?: string,"mime_type"?: string,"name"?: string,"path"?: string,"size"?: number,"text"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"drafts": {
                  Row: {
                    "attachment_ids": (string)[],"bcc_emails": (string)[],"body": string,"cc_emails": (string)[],"created_at": string,"gmail_message_id": string | null,"id": string,"opportunity_id": string,"recipient_email": string,"sent_at": string | null,"status": string,"subject": string,"updated_at": string,"user_id": string,"version": number
                  }
                  Insert: {
                    "attachment_ids"?: (string)[],"bcc_emails"?: (string)[],"body": string,"cc_emails"?: (string)[],"created_at"?: string,"gmail_message_id"?: string | null,"id"?: string,"opportunity_id": string,"recipient_email": string,"sent_at"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "attachment_ids"?: (string)[],"bcc_emails"?: (string)[],"body"?: string,"cc_emails"?: (string)[],"created_at"?: string,"gmail_message_id"?: string | null,"id"?: string,"opportunity_id"?: string,"recipient_email"?: string,"sent_at"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "drafts_opportunity_id_user_id_fkey"
      columns: ["opportunity_id","user_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"integration_credentials": {
                  Row: {
                    "encrypted_payload": string,"id": string,"kind": string,"reference": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "encrypted_payload": string,"id"?: string,"kind": string,"reference": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "encrypted_payload"?: string,"id"?: string,"kind"?: string,"reference"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mcp_configs": {
                  Row: {
                    "allowed_tools": (string)[],"enabled": boolean,"id": string,"name": string,"url": string,"user_id": string
                  }
                  Insert: {
                    "allowed_tools"?: (string)[],"enabled"?: boolean,"id"?: string,"name": string,"url": string,"user_id": string
                  }
                  Update: {
                    "allowed_tools"?: (string)[],"enabled"?: boolean,"id"?: string,"name"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memories": {
                  Row: {
                    "conflict_source_message_id": string | null,"content": string,"created_at": string,"evidence": string,"id": string,"key": string,"proposal": string | null,"search": unknown,"source_message_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "conflict_source_message_id"?: string | null,"content": string,"created_at"?: string,"evidence"?: string,"id"?: string,"key": string,"proposal"?: string | null,"search"?: never,"source_message_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "conflict_source_message_id"?: string | null,"content"?: string,"created_at"?: string,"evidence"?: string,"id"?: string,"key"?: string,"proposal"?: string | null,"search"?: never,"source_message_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_conflict_source_message_id_user_id_fkey"
      columns: ["conflict_source_message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "memories_source_message_id_user_id_fkey"
      columns: ["source_message_id","user_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"excluded_from_context": boolean,"id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"excluded_from_context"?: boolean,"id"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"excluded_from_context"?: boolean,"id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_user_id_fkey"
      columns: ["conversation_id","user_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "company": string,"created_at": string,"document_id": string | null,"id": string,"input": string,"instructions": string,"job_id": string,"job_url": string,"notes": string,"outcome": string,"recipient_email": string,"recipient_name": string,"research": string,"role": string,"status": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "company"?: string,"created_at"?: string,"document_id"?: string | null,"id"?: string,"input": string,"instructions"?: string,"job_id"?: string,"job_url"?: string,"notes"?: string,"outcome"?: string,"recipient_email"?: string,"recipient_name"?: string,"research"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "company"?: string,"created_at"?: string,"document_id"?: string | null,"id"?: string,"input"?: string,"instructions"?: string,"job_id"?: string,"job_url"?: string,"notes"?: string,"outcome"?: string,"recipient_email"?: string,"recipient_name"?: string,"research"?: string,"role"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_document_id_user_id_fkey"
      columns: ["document_id","user_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "data": NonNullable<Json>,"settings": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "data"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"settings"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"research_sources": {
                  Row: {
                    "content": string,"id": string,"opportunity_id": string,"retrieved_at": string,"title": string,"url": string,"user_id": string
                  }
                  Insert: {
                    "content": string,"id"?: string,"opportunity_id": string,"retrieved_at"?: string,"title": string,"url": string,"user_id": string
                  }
                  Update: {
                    "content"?: string,"id"?: string,"opportunity_id"?: string,"retrieved_at"?: string,"title"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_sources_opportunity_id_user_id_fkey"
      columns: ["opportunity_id","user_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"send_attempts": {
                  Row: {
                    "created_at": string,"draft_id": string,"error": string | null,"finished_at": string | null,"gmail_message_id": string | null,"id": string,"idempotency_key": string,"snapshot": NonNullable<Json>,"status": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"draft_id": string,"error"?: string | null,"finished_at"?: string | null,"gmail_message_id"?: string | null,"id"?: string,"idempotency_key": string,"snapshot": NonNullable<Json>,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"draft_id"?: string,"error"?: string | null,"finished_at"?: string | null,"gmail_message_id"?: string | null,"id"?: string,"idempotency_key"?: string,"snapshot"?: NonNullable<Json>,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "send_attempts_draft_id_user_id_fkey"
      columns: ["draft_id","user_id"]
isOneToOne: false
      referencedRelation: "drafts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_send":
{ Args: { "p_draft_id": string,"p_key": string,"p_snapshot": Json,"p_user_id": string,"p_version": number }; Returns: string
                           },
"delete_opportunity":
{ Args: { "p_opportunity_id": string,"p_user_id": string }; Returns: boolean
                           },
"finish_send":
{ Args: { "p_attempt_id": string,"p_error": string,"p_message_id": string,"p_status": string,"p_user_id": string }; Returns: undefined
                           },
"relevant_memories":
{ Args: { "p_query": string,"p_user_id": string }; Returns: {
              "conflict_source_message_id": string | null,
"content": string,
"created_at": string,
"evidence": string,
"id": string,
"key": string,
"proposal": string | null,
"search": unknown,
"source_message_id": string | null,
"status": string,
"updated_at": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "memories"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_default_document":
{ Args: { "p_document_id": string,"p_user_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
