export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_tutor_messages: {
        Row: {
          citations_json: Json
          content: string
          created_at: string
          id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          citations_json?: Json
          content: string
          created_at?: string
          id?: string
          sender_role: string
          thread_id: string
        }
        Update: {
          citations_json?: Json
          content?: string
          created_at?: string
          id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tutor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_tutor_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tutor_threads: {
        Row: {
          created_at: string
          id: string
          student_user_id: string
          title: string
          updated_at: string
          virtual_course_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_user_id: string
          title?: string
          updated_at?: string
          virtual_course_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_user_id?: string
          title?: string
          updated_at?: string
          virtual_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tutor_threads_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tutor_threads_virtual_course_id_fkey"
            columns: ["virtual_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          ai_pre_evaluation: Json | null
          assignment_id: string
          content_sha256: string | null
          enrollment_id: string
          file_path: string | null
          id: string
          is_late: boolean
          submitted_at: string
          teacher_feedback: string | null
          text_answer: string | null
        }
        Insert: {
          ai_pre_evaluation?: Json | null
          assignment_id: string
          content_sha256?: string | null
          enrollment_id: string
          file_path?: string | null
          id?: string
          is_late?: boolean
          submitted_at?: string
          teacher_feedback?: string | null
          text_answer?: string | null
        }
        Update: {
          ai_pre_evaluation?: Json | null
          assignment_id?: string
          content_sha256?: string | null
          enrollment_id?: string
          file_path?: string | null
          id?: string
          is_late?: boolean
          submitted_at?: string
          teacher_feedback?: string | null
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          course_module_id: string
          created_at: string
          due_at: string | null
          id: string
          instructions: string
          rubric_json: Json
          title: string
          updated_at: string
        }
        Insert: {
          allow_late?: boolean
          course_module_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions: string
          rubric_json?: Json
          title: string
          updated_at?: string
        }
        Update: {
          allow_late?: boolean
          course_module_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          instructions?: string
          rubric_json?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_module_id_fkey"
            columns: ["course_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_session_id: string
          client_mutation_id: string
          created_at: string
          enrollment_id: string
          id: string
          note: string | null
          status: string
        }
        Insert: {
          attendance_session_id: string
          client_mutation_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          attendance_session_id?: string
          client_mutation_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_attendance_session_id_fkey"
            columns: ["attendance_session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          block_label: string
          created_by: string
          id: string
          momento_id: string
          recorded_mode: string
          session_date: string
          synced_at: string
          teacher_assignment_id: string
        }
        Insert: {
          block_label: string
          created_by: string
          id?: string
          momento_id: string
          recorded_mode?: string
          session_date: string
          synced_at?: string
          teacher_assignment_id: string
        }
        Update: {
          block_label?: string
          created_by?: string
          id?: string
          momento_id?: string
          recorded_mode?: string
          session_date?: string
          synced_at?: string
          teacher_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_momento_id_fkey"
            columns: ["momento_id"]
            isOneToOne: false
            referencedRelation: "momentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      audiovisual_reservations: {
        Row: {
          block_end: string
          block_start: string
          created_at: string
          deleted_at: string | null
          id: string
          purpose: string
          reserved_date: string
          resource_id: string
          slot_range: unknown
          status: string
          teacher_user_id: string
        }
        Insert: {
          block_end: string
          block_start: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          purpose: string
          reserved_date: string
          resource_id: string
          slot_range?: unknown
          status?: string
          teacher_user_id: string
        }
        Update: {
          block_end?: string
          block_start?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          purpose?: string
          reserved_date?: string
          resource_id?: string
          slot_range?: unknown
          status?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiovisual_reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "audiovisual_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiovisual_reservations_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audiovisual_resources: {
        Row: {
          asset_qr_code: string
          category: string
          condition_status: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          asset_qr_code: string
          category: string
          condition_status?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          asset_qr_code?: string
          category?: string
          condition_status?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      class_diary_entries: {
        Row: {
          author_user_id: string
          classroom_incidents: string | null
          created_at: string
          derive_to_orientation: boolean
          entry_date: string
          id: string
          teacher_assignment_id: string
          topic_covered: string
        }
        Insert: {
          author_user_id: string
          classroom_incidents?: string | null
          created_at?: string
          derive_to_orientation?: boolean
          entry_date?: string
          id?: string
          teacher_assignment_id: string
          topic_covered: string
        }
        Update: {
          author_user_id?: string
          classroom_incidents?: string | null
          created_at?: string
          derive_to_orientation?: boolean
          entry_date?: string
          id?: string
          teacher_assignment_id?: string
          topic_covered?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_diary_entries_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_diary_entries_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_module_id: string
          created_at: string
          id: string
          material_type: string
          rag_status: string
          storage_path_or_url: string
          title: string
        }
        Insert: {
          course_module_id: string
          created_at?: string
          id?: string
          material_type: string
          rag_status?: string
          storage_path_or_url: string
          title: string
        }
        Update: {
          course_module_id?: string
          created_at?: string
          id?: string
          material_type?: string
          rag_status?: string
          storage_path_or_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_module_id_fkey"
            columns: ["course_module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          sort_order: number
          title: string
          virtual_course_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          sort_order?: number
          title: string
          virtual_course_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          sort_order?: number
          title?: string
          virtual_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_virtual_course_id_fkey"
            columns: ["virtual_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subjects: {
        Row: {
          created_at: string
          grade_year: number
          id: string
          is_active: boolean
          mencion_id: string
          subject_id: string
          weekly_hours: number
        }
        Insert: {
          created_at?: string
          grade_year: number
          id?: string
          is_active?: boolean
          mencion_id: string
          subject_id: string
          weekly_hours?: number
        }
        Update: {
          created_at?: string
          grade_year?: number
          id?: string
          is_active?: boolean
          mencion_id?: string
          subject_id?: string
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subjects_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          deleted_at: string | null
          emergency_contact_cedula: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          enrollment_status: string
          enrollment_type: string
          grade_year: number
          id: string
          mencion_id: string
          ocr_extracted_metadata: Json
          school_year_id: string
          section_id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          emergency_contact_cedula?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          enrollment_status?: string
          enrollment_type?: string
          grade_year: number
          id?: string
          mencion_id: string
          ocr_extracted_metadata?: Json
          school_year_id: string
          section_id: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          emergency_contact_cedula?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          enrollment_status?: string
          enrollment_type?: string
          grade_year?: number
          id?: string
          mencion_id?: string
          ocr_extracted_metadata?: Json
          school_year_id?: string
          section_id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_items: {
        Row: {
          created_at: string
          evaluation_plan_id: string
          evaluation_type: string
          id: string
          linked_assignment_id: string | null
          linked_exam_id: string | null
          max_points: number
          scheduled_date: string | null
          title: string
          weight_percent: number
        }
        Insert: {
          created_at?: string
          evaluation_plan_id: string
          evaluation_type: string
          id?: string
          linked_assignment_id?: string | null
          linked_exam_id?: string | null
          max_points?: number
          scheduled_date?: string | null
          title: string
          weight_percent: number
        }
        Update: {
          created_at?: string
          evaluation_plan_id?: string
          evaluation_type?: string
          id?: string
          linked_assignment_id?: string | null
          linked_exam_id?: string | null
          max_points?: number
          scheduled_date?: string | null
          title?: string
          weight_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_items_evaluation_plan_id_fkey"
            columns: ["evaluation_plan_id"]
            isOneToOne: false
            referencedRelation: "evaluation_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_items_linked_assignment_id_fkey"
            columns: ["linked_assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_items_linked_exam_id_fkey"
            columns: ["linked_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_plans: {
        Row: {
          created_at: string
          id: string
          momento_id: string
          planning_ai_notes: string | null
          status: string
          teacher_assignment_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          momento_id: string
          planning_ai_notes?: string | null
          status?: string
          teacher_assignment_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          momento_id?: string
          planning_ai_notes?: string | null
          status?: string
          teacher_assignment_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_plans_momento_id_fkey"
            columns: ["momento_id"]
            isOneToOne: false
            referencedRelation: "momentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_plans_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers_json: Json
          attempt_number: number
          computed_score: number | null
          enrollment_id: string
          id: string
          online_exam_id: string
          started_at: string
          submitted_at: string | null
        }
        Insert: {
          answers_json?: Json
          attempt_number?: number
          computed_score?: number | null
          enrollment_id: string
          id?: string
          online_exam_id: string
          started_at?: string
          submitted_at?: string | null
        }
        Update: {
          answers_json?: Json
          attempt_number?: number
          computed_score?: number | null
          enrollment_id?: string
          id?: string
          online_exam_id?: string
          started_at?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_online_exam_id_fkey"
            columns: ["online_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer_json: Json
          created_at: string
          generated_by_ai: boolean
          id: string
          online_exam_id: string
          options_json: Json
          points: number
          prompt: string
          question_type: string
          sort_order: number
        }
        Insert: {
          correct_answer_json: Json
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          online_exam_id: string
          options_json: Json
          points?: number
          prompt: string
          question_type: string
          sort_order?: number
        }
        Update: {
          correct_answer_json?: Json
          created_at?: string
          generated_by_ai?: boolean
          id?: string
          online_exam_id?: string
          options_json?: Json
          points?: number
          prompt?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_online_exam_id_fkey"
            columns: ["online_exam_id"]
            isOneToOne: false
            referencedRelation: "online_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          enrollment_id: string | null
          id: string
          ip_hash: string | null
          new_value: Json
          previous_value: Json | null
          reason: string | null
          target_record_id: string
          target_table: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          ip_hash?: string | null
          new_value: Json
          previous_value?: Json | null
          reason?: string | null
          target_record_id: string
          target_table: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          ip_hash?: string | null
          new_value?: Json
          previous_value?: Json | null
          reason?: string | null
          target_record_id?: string
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_audit_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
          verification_type: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
          verification_type: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
          verification_type?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_companies: {
        Row: {
          address: string
          available_slots: number
          business_name: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          parish_zone: string
          rif: string
          sector: string
          updated_at: string
        }
        Insert: {
          address: string
          available_slots?: number
          business_name: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          parish_zone: string
          rif: string
          sector: string
          updated_at?: string
        }
        Update: {
          address?: string
          available_slots?: number
          business_name?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          parish_zone?: string
          rif?: string
          sector?: string
          updated_at?: string
        }
        Relationships: []
      }
      internship_evaluations: {
        Row: {
          evaluator_type: string
          final_score: number
          id: string
          magic_link_id: string | null
          observations: string | null
          placement_id: string
          rubric_scores_json: Json
          submitted_at: string
        }
        Insert: {
          evaluator_type: string
          final_score: number
          id?: string
          magic_link_id?: string | null
          observations?: string | null
          placement_id: string
          rubric_scores_json: Json
          submitted_at?: string
        }
        Update: {
          evaluator_type?: string
          final_score?: number
          id?: string
          magic_link_id?: string | null
          observations?: string | null
          placement_id?: string
          rubric_scores_json?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_evaluations_magic_link_id_fkey"
            columns: ["magic_link_id"]
            isOneToOne: false
            referencedRelation: "internship_magic_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_evaluations_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "internship_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_magic_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          max_uses: number
          placement_id: string
          token_hash: string
          tutor_email: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          max_uses?: number
          placement_id: string
          token_hash: string
          tutor_email: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          max_uses?: number
          placement_id?: string
          token_hash?: string
          tutor_email?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internship_magic_links_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "internship_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_placements: {
        Row: {
          academic_tutor_user_id: string
          ai_match_score: number | null
          company_id: string
          company_tutor_email: string | null
          company_tutor_name: string
          created_at: string
          end_date: string
          enrollment_id: string
          id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_tutor_user_id: string
          ai_match_score?: number | null
          company_id: string
          company_tutor_email?: string | null
          company_tutor_name: string
          created_at?: string
          end_date: string
          enrollment_id: string
          id?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_tutor_user_id?: string
          ai_match_score?: number | null
          company_id?: string
          company_tutor_email?: string | null
          company_tutor_name?: string
          created_at?: string
          end_date?: string
          enrollment_id?: string
          id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internship_placements_academic_tutor_user_id_fkey"
            columns: ["academic_tutor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_placements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "internship_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_placements_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_reports: {
        Row: {
          academic_status: string
          ai_normative_review: Json | null
          created_at: string
          file_path_or_drive_id: string
          id: string
          placement_id: string
          version_number: number
        }
        Insert: {
          academic_status?: string
          ai_normative_review?: Json | null
          created_at?: string
          file_path_or_drive_id: string
          id?: string
          placement_id: string
          version_number?: number
        }
        Update: {
          academic_status?: string
          ai_normative_review?: Json | null
          created_at?: string
          file_path_or_drive_id?: string
          id?: string
          placement_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "internship_reports_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "internship_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_weekly_logs: {
        Row: {
          activities_summary: string
          created_at: string
          hours_logged: number
          id: string
          placement_id: string
          tutor_approved: boolean
          tutor_comment: string | null
          updated_at: string
          week_number: number
        }
        Insert: {
          activities_summary: string
          created_at?: string
          hours_logged: number
          id?: string
          placement_id: string
          tutor_approved?: boolean
          tutor_comment?: string | null
          updated_at?: string
          week_number: number
        }
        Update: {
          activities_summary?: string
          created_at?: string
          hours_logged?: number
          id?: string
          placement_id?: string
          tutor_approved?: boolean
          tutor_comment?: string | null
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "internship_weekly_logs_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "internship_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          author: string
          available_copies: number
          cover_webp_url: string | null
          created_at: string
          id: string
          is_active: boolean
          item_type: string
          mencion_id: string | null
          qr_code: string
          title: string
          total_copies: number
          updated_at: string
        }
        Insert: {
          author: string
          available_copies?: number
          cover_webp_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_type: string
          mencion_id?: string | null
          qr_code: string
          title: string
          total_copies?: number
          updated_at?: string
        }
        Update: {
          author?: string
          available_copies?: number
          cover_webp_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_type?: string
          mencion_id?: string | null
          qr_code?: string
          title?: string
          total_copies?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
        ]
      }
      library_loans: {
        Row: {
          borrower_user_id: string
          deleted_at: string | null
          due_date: string
          id: string
          issued_by_user_id: string
          library_item_id: string
          loaned_at: string
          returned_at: string | null
          status: string
        }
        Insert: {
          borrower_user_id: string
          deleted_at?: string | null
          due_date: string
          id?: string
          issued_by_user_id: string
          library_item_id: string
          loaned_at?: string
          returned_at?: string | null
          status?: string
        }
        Update: {
          borrower_user_id?: string
          deleted_at?: string | null
          due_date?: string
          id?: string
          issued_by_user_id?: string
          library_item_id?: string
          loaned_at?: string
          returned_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_loans_borrower_user_id_fkey"
            columns: ["borrower_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_issued_by_user_id_fkey"
            columns: ["issued_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_loans_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menciones: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      mention_lab_scenarios: {
        Row: {
          config_json: Json
          created_at: string
          created_by: string | null
          evaluation_item_id: string | null
          grade_year: number
          id: string
          instructions: string
          is_base_catalog: boolean
          mencion_id: string
          title: string
          tool_type: string
          updated_at: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          evaluation_item_id?: string | null
          grade_year: number
          id?: string
          instructions: string
          is_base_catalog?: boolean
          mencion_id: string
          title: string
          tool_type: string
          updated_at?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          created_by?: string | null
          evaluation_item_id?: string | null
          grade_year?: number
          id?: string
          instructions?: string
          is_base_catalog?: boolean
          mencion_id?: string
          title?: string
          tool_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mention_lab_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_lab_scenarios_evaluation_item_id_fkey"
            columns: ["evaluation_item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_lab_scenarios_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mention_lab_submissions: {
        Row: {
          auto_check_result: Json | null
          enrollment_id: string
          feedback: string | null
          id: string
          scenario_id: string
          submission_payload: Json
          submitted_at: string
          teacher_score: number | null
        }
        Insert: {
          auto_check_result?: Json | null
          enrollment_id: string
          feedback?: string | null
          id?: string
          scenario_id: string
          submission_payload: Json
          submitted_at?: string
          teacher_score?: number | null
        }
        Update: {
          auto_check_result?: Json | null
          enrollment_id?: string
          feedback?: string | null
          id?: string
          scenario_id?: string
          submission_payload?: Json
          submitted_at?: string
          teacher_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mention_lab_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_lab_submissions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "mention_lab_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_final_grades: {
        Row: {
          approved_by: string | null
          created_at: string
          curriculum_subject_id: string
          enrollment_id: string
          final_literal: string | null
          final_numeric: number | null
          id: string
          is_locked: boolean
          momento_id: string
          qualitative_observation: string | null
          raw_weighted_avg: number | null
          reopened_until: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          curriculum_subject_id: string
          enrollment_id: string
          final_literal?: string | null
          final_numeric?: number | null
          id?: string
          is_locked?: boolean
          momento_id: string
          qualitative_observation?: string | null
          raw_weighted_avg?: number | null
          reopened_until?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          curriculum_subject_id?: string
          enrollment_id?: string
          final_literal?: string | null
          final_numeric?: number | null
          id?: string
          is_locked?: boolean
          momento_id?: string
          qualitative_observation?: string | null
          raw_weighted_avg?: number | null
          reopened_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_final_grades_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_final_grades_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_final_grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moment_final_grades_momento_id_fkey"
            columns: ["momento_id"]
            isOneToOne: false
            referencedRelation: "momentos"
            referencedColumns: ["id"]
          },
        ]
      }
      momentos: {
        Row: {
          created_at: string
          end_date: string
          grade_entry_close_at: string | null
          grade_entry_open_at: string | null
          id: string
          moment_number: number
          name: string
          school_year_id: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          grade_entry_close_at?: string | null
          grade_entry_open_at?: string | null
          id?: string
          moment_number: number
          name: string
          school_year_id: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          grade_entry_close_at?: string | null
          grade_entry_open_at?: string | null
          id?: string
          moment_number?: number
          name?: string
          school_year_id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "momentos_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_email_logs: {
        Row: {
          created_at: string
          id: string
          notification_id: string | null
          provider: string
          provider_message_id: string | null
          recipient_email: string
          status: string
          template_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id?: string | null
          provider: string
          provider_message_id?: string | null
          recipient_email: string
          status?: string
          template_code: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          status?: string
          template_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_email_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          category: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        Insert: {
          action_url?: string | null
          body: string
          category: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_user_id: string
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      official_documents: {
        Row: {
          document_hash: string
          document_type: string
          id: string
          issued_at: string
          issued_by: string
          payload_snapshot: Json
          revoked_at: string | null
          status: string
          student_user_id: string
          verification_code: string
        }
        Insert: {
          document_hash: string
          document_type: string
          id?: string
          issued_at?: string
          issued_by: string
          payload_snapshot: Json
          revoked_at?: string | null
          status?: string
          student_user_id: string
          verification_code: string
        }
        Update: {
          document_hash?: string
          document_type?: string
          id?: string
          issued_at?: string
          issued_by?: string
          payload_snapshot?: Json
          revoked_at?: string | null
          status?: string
          student_user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_documents_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_documents_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      online_exams: {
        Row: {
          closes_at: string
          created_at: string
          duration_minutes: number
          id: string
          max_attempts: number
          opens_at: string
          sync_to_evaluation_item_id: string | null
          title: string
          virtual_course_id: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          duration_minutes?: number
          id?: string
          max_attempts?: number
          opens_at: string
          sync_to_evaluation_item_id?: string | null
          title: string
          virtual_course_id: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          max_attempts?: number
          opens_at?: string
          sync_to_evaluation_item_id?: string | null
          title?: string
          virtual_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_online_exams_sync_evaluation_item"
            columns: ["sync_to_evaluation_item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_exams_virtual_course_id_fkey"
            columns: ["virtual_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      orientation_followups: {
        Row: {
          agreements: string | null
          created_at: string
          id: string
          next_review_date: string | null
          observations: string
          orientation_record_id: string
          recorded_by: string
          session_date: string
        }
        Insert: {
          agreements?: string | null
          created_at?: string
          id?: string
          next_review_date?: string | null
          observations: string
          orientation_record_id: string
          recorded_by: string
          session_date?: string
        }
        Update: {
          agreements?: string | null
          created_at?: string
          id?: string
          next_review_date?: string | null
          observations?: string
          orientation_record_id?: string
          recorded_by?: string
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "orientation_followups_orientation_record_id_fkey"
            columns: ["orientation_record_id"]
            isOneToOne: false
            referencedRelation: "orientation_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orientation_followups_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orientation_records: {
        Row: {
          case_code: string
          confidential_notes_encrypted: string | null
          created_at: string
          id: string
          opened_by: string
          record_category: string
          risk_level: string
          school_year_id: string
          status: string
          student_user_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          case_code: string
          confidential_notes_encrypted?: string | null
          created_at?: string
          id?: string
          opened_by: string
          record_category: string
          risk_level?: string
          school_year_id: string
          status?: string
          student_user_id: string
          summary: string
          updated_at?: string
        }
        Update: {
          case_code?: string
          confidential_notes_encrypted?: string | null
          created_at?: string
          id?: string
          opened_by?: string
          record_category?: string
          risk_level?: string
          school_year_id?: string
          status?: string
          student_user_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orientation_records_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orientation_records_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orientation_records_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_subject_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          curriculum_subject_id: string
          evaluator_user_id: string
          exam_date: string
          final_numeric: number
          id: string
          passed: boolean | null
          school_year_id: string
          student_user_id: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          curriculum_subject_id: string
          evaluator_user_id: string
          exam_date?: string
          final_numeric: number
          id?: string
          passed?: boolean | null
          school_year_id: string
          student_user_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          curriculum_subject_id?: string
          evaluator_user_id?: string
          exam_date?: string
          final_numeric?: number
          id?: string
          passed?: boolean | null
          school_year_id?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_subject_attempts_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_subject_attempts_evaluator_user_id_fkey"
            columns: ["evaluator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_subject_attempts_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_subject_attempts_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      rag_material_chunks: {
        Row: {
          chunk_index: number
          content: string
          course_material_id: string
          created_at: string
          embedding: string
          id: string
          token_count: number
          virtual_course_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          course_material_id: string
          created_at?: string
          embedding: string
          id?: string
          token_count?: number
          virtual_course_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          course_material_id?: string
          created_at?: string
          embedding?: string
          id?: string
          token_count?: number
          virtual_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rag_material_chunks_course_material_id_fkey"
            columns: ["course_material_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_material_chunks_virtual_course_id_fkey"
            columns: ["virtual_course_id"]
            isOneToOne: false
            referencedRelation: "virtual_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          hierarchy_level: number
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          requires_workspace: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          requires_workspace?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          hierarchy_level?: number
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          requires_workspace?: boolean
        }
        Relationships: []
      }
      school_years: {
        Row: {
          code: string
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      section_schedules: {
        Row: {
          block_label: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          room_label: string
          school_year_id: string
          section_id: string
          slot_range: unknown
          start_time: string
          teacher_assignment_id: string
          updated_at: string
        }
        Insert: {
          block_label: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          room_label?: string
          school_year_id: string
          section_id: string
          slot_range?: unknown
          start_time: string
          teacher_assignment_id: string
          updated_at?: string
        }
        Update: {
          block_label?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          room_label?: string
          school_year_id?: string
          section_id?: string
          slot_range?: unknown
          start_time?: string
          teacher_assignment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_schedules_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_schedules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_schedules_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: false
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          capacity: number
          created_at: string
          deleted_at: string | null
          grade_year: number
          id: string
          mencion_id: string
          school_year_id: string
          section_letter: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          grade_year: number
          id?: string
          mencion_id: string
          school_year_id: string
          section_letter: string
        }
        Update: {
          capacity?: number
          created_at?: string
          deleted_at?: string | null
          grade_year?: number
          id?: string
          mencion_id?: string
          school_year_id?: string
          section_letter?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      student_dossier_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          ocr_verified: boolean
          storage_path: string
          student_user_id: string
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          ocr_verified?: boolean
          storage_path: string
          student_user_id: string
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          ocr_verified?: boolean
          storage_path?: string
          student_user_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_dossier_documents_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_dossier_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_requests: {
        Row: {
          client_request_id: string | null
          created_at: string
          enrollment_id: string | null
          id: string
          official_document_id: string | null
          reason: string | null
          request_type: string
          resolved_at: string | null
          resolved_by: string | null
          sla_entered_at: string
          status: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          official_document_id?: string | null
          reason?: string | null
          request_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          sla_entered_at?: string
          status?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          official_document_id?: string | null
          reason?: string | null
          request_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sla_entered_at?: string
          status?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_official_document_id_fkey"
            columns: ["official_document_id"]
            isOneToOne: false
            referencedRelation: "official_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_requests_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_scores: {
        Row: {
          created_at: string
          deleted_at: string | null
          enrollment_id: string
          evaluation_item_id: string
          id: string
          literal_grade: string | null
          numeric_score: number | null
          recorded_by: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          enrollment_id: string
          evaluation_item_id: string
          id?: string
          literal_grade?: string | null
          numeric_score?: number | null
          recorded_by: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          enrollment_id?: string
          evaluation_item_id?: string
          id?: string
          literal_grade?: string | null
          numeric_score?: number | null
          recorded_by?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_scores_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_scores_evaluation_item_id_fkey"
            columns: ["evaluation_item_id"]
            isOneToOne: false
            referencedRelation: "evaluation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_scores_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          grading_scale: string
          id: string
          is_technical_core: boolean
          name: string
          passing_threshold: number
        }
        Insert: {
          code: string
          created_at?: string
          grading_scale?: string
          id?: string
          is_technical_core?: boolean
          name: string
          passing_threshold?: number
        }
        Update: {
          code?: string
          created_at?: string
          grading_scale?: string
          id?: string
          is_technical_core?: boolean
          name?: string
          passing_threshold?: number
        }
        Relationships: []
      }
      teacher_absences: {
        Row: {
          absence_date: string
          affected_blocks: Json
          created_at: string
          id: string
          observation: string | null
          reason_category: string
          reviewed_by: string | null
          status: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          absence_date: string
          affected_blocks?: Json
          created_at?: string
          id?: string
          observation?: string | null
          reason_category: string
          reviewed_by?: string | null
          status?: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          absence_date?: string
          affected_blocks?: Json
          created_at?: string
          id?: string
          observation?: string | null
          reason_category?: string
          reviewed_by?: string | null
          status?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_absences_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_absences_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          created_at: string
          curriculum_subject_id: string
          id: string
          is_active: boolean
          school_year_id: string
          section_id: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_subject_id: string
          id?: string
          is_active?: boolean
          school_year_id: string
          section_id: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_subject_id?: string
          id?: string
          is_active?: boolean
          school_year_id?: string
          section_id?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_curriculum_subject_id_fkey"
            columns: ["curriculum_subject_id"]
            isOneToOne: false
            referencedRelation: "curriculum_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          is_active: boolean
          mencion_id: string | null
          role_id: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mencion_id?: string | null
          role_id: string
          user_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mencion_id?: string | null
          role_id?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_mencion_id_fkey"
            columns: ["mencion_id"]
            isOneToOne: false
            referencedRelation: "menciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_tier: string
          auth_user_id: string | null
          avatar_webp_url: string | null
          cedula: string
          created_at: string
          deleted_at: string | null
          first_name: string
          id: string
          institutional_email: string | null
          is_active: boolean
          last_name: string
          phone: string | null
          qr_token_secret: string
          recovery_email: string | null
          updated_at: string
          workspace_verified_at: string | null
        }
        Insert: {
          access_tier?: string
          auth_user_id?: string | null
          avatar_webp_url?: string | null
          cedula: string
          created_at?: string
          deleted_at?: string | null
          first_name: string
          id?: string
          institutional_email?: string | null
          is_active?: boolean
          last_name: string
          phone?: string | null
          qr_token_secret?: string
          recovery_email?: string | null
          updated_at?: string
          workspace_verified_at?: string | null
        }
        Update: {
          access_tier?: string
          auth_user_id?: string | null
          avatar_webp_url?: string | null
          cedula?: string
          created_at?: string
          deleted_at?: string | null
          first_name?: string
          id?: string
          institutional_email?: string | null
          is_active?: boolean
          last_name?: string
          phone?: string | null
          qr_token_secret?: string
          recovery_email?: string | null
          updated_at?: string
          workspace_verified_at?: string | null
        }
        Relationships: []
      }
      virtual_courses: {
        Row: {
          ai_tutor_enabled: boolean
          created_at: string
          id: string
          is_published: boolean
          teacher_assignment_id: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          ai_tutor_enabled?: boolean
          created_at?: string
          id?: string
          is_published?: boolean
          teacher_assignment_id: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          ai_tutor_enabled?: boolean
          created_at?: string
          id?: string
          is_published?: boolean
          teacher_assignment_id?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "virtual_courses_teacher_assignment_id_fkey"
            columns: ["teacher_assignment_id"]
            isOneToOne: true
            referencedRelation: "teacher_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      siga_actualizar_correo_recuperacion: {
        Args: { p_recovery_email: string }
        Returns: Json
      }
      siga_cancelar_solicitud_estudiante: {
        Args: { p_request_id: string }
        Returns: Json
      }
      siga_crear_solicitud_estudiante: {
        Args: {
          p_client_request_id?: string
          p_reason?: string
          p_request_type: string
        }
        Returns: Json
      }
      siga_dev_get_student_sandbox_state: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      siga_dev_manage_student_synthetic_data: {
        Args: { p_action?: string; p_reference_date?: string }
        Returns: Json
      }
      siga_dev_switch_student_context: {
        Args: {
          p_access_tier?: string
          p_active_moment?: number
          p_grade_year?: number
          p_mencion_code?: string
          p_reference_date?: string
          p_school_year_code?: string
          p_section_letter?: string
        }
        Returns: Json
      }
      siga_devolver_prestamo_biblioteca: {
        Args: { p_loan_id: string }
        Returns: Json
      }
      siga_generar_token_carnet: {
        Args: { p_ttl_seconds?: number }
        Returns: Json
      }
      siga_gestionar_user_role: {
        Args: {
          p_grant: boolean
          p_mencion_id?: string
          p_role_code: string
          p_target_user_id: string
          p_valid_until?: string
        }
        Returns: Json
      }
      siga_get_exam_questions_student: {
        Args: { p_online_exam_id: string }
        Returns: {
          id: string
          options_json: Json
          points: number
          prompt: string
          question_type: string
          sort_order: number
        }[]
      }
      siga_get_student_section_schedule: {
        Args: Record<PropertyKey, never>
        Returns: {
          block_label: string
          day_of_week: number
          end_time: string
          id: string
          room_label: string
          start_time: string
          subject_code: string
          subject_name: string
          teacher_name: string
        }[]
      }
      siga_get_student_subject_telemetry: {
        Args: Record<PropertyKey, never>
        Returns: {
          absent_count: number
          curriculum_subject_id: string
          justified_count: number
          late_count: number
          present_count: number
          subject_code: string
          teacher_name: string | null
          total_sessions: number
        }[]
      }
      siga_match_rag_chunks: {
        Args: {
          p_match_count?: number
          p_query_embedding: string
          p_virtual_course_id: string
        }
        Returns: {
          chunk_id: string
          content: string
          course_material_id: string
          material_title: string
          similarity: number
        }[]
      }
      siga_public_verificar_documento: {
        Args: { p_verification_code: string }
        Returns: Json
      }
      siga_registrar_nota: {
        Args: {
          p_enrollment_id: string
          p_evaluation_item_id: string
          p_literal_grade?: string
          p_numeric_score?: number
          p_reason?: string
          p_source?: string
        }
        Returns: Json
      }
      siga_registrar_prestamo_biblioteca: {
        Args: {
          p_borrower_user_id: string
          p_due_date: string
          p_library_item_id: string
        }
        Returns: Json
      }
      siga_reservar_audiovisual: {
        Args: {
          p_block_end: string
          p_block_start: string
          p_purpose: string
          p_reserved_date: string
          p_resource_id: string
        }
        Returns: Json
      }
      siga_service_claim_workflow_run: {
        Args: {
          p_expected_run_id?: string | null
          p_source_record_id: string
          p_source_table?: string
          p_workflow_code: string
        }
        Returns: Json
      }
      siga_service_finish_workflow_run: {
        Args: {
          p_error_message?: string
          p_result_json?: Json
          p_status: string
          p_workflow_run_id: string
        }
        Returns: Json
      }
      siga_submit_exam_attempt: {
        Args: { p_answers: Json; p_online_exam_id: string }
        Returns: Json
      }
      siga_sync_attendance_batch: {
        Args: {
          p_block_label: string
          p_momento_id: string
          p_recorded_mode: string
          p_records: Json
          p_session_date: string
          p_teacher_assignment_id: string
        }
        Returns: Json
      }
      siga_verificar_token_carnet: {
        Args: { p_token: string }
        Returns: Json
      }
      siga_guardar_expediente_orientacion: {
        Args: {
          p_case_code: string
          p_confidential_notes: string
          p_encryption_key?: string
          p_record_category: string
          p_risk_level?: string
          p_school_year_id: string
          p_student_user_id: string
          p_summary: string
        }
        Returns: Json
      }
      siga_leer_expediente_orientacion: {
        Args: {
          p_encryption_key?: string
          p_record_id: string
        }
        Returns: Json
      }
      siga_verificar_duplicado_entrega: {
        Args: {
          p_assignment_id: string
          p_content_sha256: string
        }
        Returns: Json
      }
      siga_public_validar_magic_link_pasantia: {
        Args: {
          p_raw_token: string
        }
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
