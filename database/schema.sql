--
-- PostgreSQL database dump
--

\restrict xyL2bjEujeCpi2knhpwYij4L2eaJK5fcZ80LjdAj2QwEvGkEMOqS7V7Rg1EILCk

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: check_low_stock_apparatus(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_low_stock_apparatus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.available_quantity_pieces <= NEW.reorder_level THEN
    -- Add or update alert: apparatus is low stock
    INSERT INTO low_stock_apparatus (apparatus_name, current_quantity_pieces, reorder_level, last_checked)
    VALUES (NEW.apparatus_name, NEW.available_quantity_pieces, NEW.reorder_level, CURRENT_DATE)
    ON CONFLICT (apparatus_name) DO UPDATE
      SET current_quantity_pieces = NEW.available_quantity_pieces,
          reorder_level = NEW.reorder_level,
          last_checked = CURRENT_DATE;
  ELSE
    -- Remove from alerts if restocked above reorder level
    DELETE FROM low_stock_apparatus WHERE apparatus_name = NEW.apparatus_name;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_low_stock_apparatus() OWNER TO postgres;

--
-- Name: check_low_stock_chemicals(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_low_stock_chemicals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
          IF NEW.quantity <= NEW.reorder_level THEN
            INSERT INTO low_stock_chemicals (chemical_name, quantity, unit, reorder_level, last_checked)
            VALUES (NEW.chemical_name, NEW.quantity, NEW.unit, NEW.reorder_level, CURRENT_DATE)
            ON CONFLICT (chemical_name) DO UPDATE
              SET quantity = NEW.quantity,
                  unit = NEW.unit,
                  reorder_level = NEW.reorder_level,
                  last_checked = CURRENT_DATE;
          ELSE
            DELETE FROM low_stock_chemicals WHERE chemical_name = NEW.chemical_name;
          END IF;
          RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.check_low_stock_chemicals() OWNER TO postgres;

--
-- Name: check_single_hod(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_single_hod() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.role = 'HOD' AND NEW.is_active = TRUE THEN
        IF EXISTS (
            SELECT 1 FROM user_account 
            WHERE role = 'HOD' 
            AND is_active = TRUE
            AND id != COALESCE(NEW.id, 0)
        ) THEN
            RAISE EXCEPTION 'Only one HOD can exist in the system';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_single_hod() OWNER TO postgres;

--
-- Name: fn_service_action_apply(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_service_action_apply() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_remaining INTEGER;
    v_apparatus_name VARCHAR(64);
BEGIN
    SELECT quantity_remaining, apparatus_name INTO v_remaining, v_apparatus_name
    FROM service_entry_items
    WHERE id = NEW.service_entry_item_id
    FOR UPDATE;

    IF v_remaining IS NULL THEN
        RAISE EXCEPTION 'Service entry item % not found', NEW.service_entry_item_id;
    END IF;

    IF NEW.quantity > v_remaining THEN
        RAISE EXCEPTION 'Requested quantity (%) exceeds remaining in-service quantity (%)', NEW.quantity, v_remaining;
    END IF;

    IF NEW.action_type = 'repaired' THEN
        UPDATE service_entry_items
        SET quantity_remaining = quantity_remaining - NEW.quantity,
            quantity_repaired  = quantity_repaired + NEW.quantity
        WHERE id = NEW.service_entry_item_id;

        UPDATE available_apparatus
        SET available_quantity_pieces = available_quantity_pieces + NEW.quantity
        WHERE LOWER(apparatus_name) = LOWER(v_apparatus_name);

    ELSIF NEW.action_type = 'damaged' THEN
        UPDATE service_entry_items
        SET quantity_remaining = quantity_remaining - NEW.quantity,
            quantity_damaged   = quantity_damaged + NEW.quantity
        WHERE id = NEW.service_entry_item_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_service_action_apply() OWNER TO postgres;

--
-- Name: fn_service_item_sent_decrement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_service_item_sent_decrement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE available_apparatus
    SET available_quantity_pieces = available_quantity_pieces - NEW.quantity_sent
    WHERE LOWER(apparatus_name) = LOWER(NEW.apparatus_name);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No matching apparatus "%" found in available_apparatus', NEW.apparatus_name;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_service_item_sent_decrement() OWNER TO postgres;

--
-- Name: subtract_damaged_apparatus_item(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.subtract_damaged_apparatus_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE available_apparatus
  SET available_quantity_pieces = GREATEST(available_quantity_pieces - NEW.quantity, 0),
      last_updated = CURRENT_DATE
  WHERE apparatus_name = NEW.apparatus_name;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.subtract_damaged_apparatus_item() OWNER TO postgres;

--
-- Name: update_available_apparatus(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_available_apparatus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO available_apparatus (apparatus_name, available_quantity_pieces, last_updated)
  VALUES (NEW.apparatus_name, NEW.quantity_pieces, CURRENT_DATE)
  ON CONFLICT (apparatus_name) DO UPDATE
    SET available_quantity_pieces = available_apparatus.available_quantity_pieces + NEW.quantity_pieces,
        last_updated = CURRENT_DATE;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_available_apparatus() OWNER TO postgres;

--
-- Name: update_available_chemicals(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_available_chemicals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO available_chemicals (chemical_name, quantity, unit, last_updated)
  VALUES (NEW.chemical_name, NEW.total_quantity, NEW.unit, CURRENT_DATE)
  ON CONFLICT (chemical_name) DO UPDATE
    SET quantity = available_chemicals.quantity + NEW.total_quantity,
        unit = NEW.unit,
        last_updated = CURRENT_DATE;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_available_chemicals() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: apparatus_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.apparatus_item (
    id integer NOT NULL,
    stock_register_id integer,
    apparatus_name character varying(64) NOT NULL,
    quantity_pieces integer NOT NULL,
    rate numeric(10,2) CONSTRAINT apparatus_item_rate_per_piece_not_null NOT NULL,
    make character varying(64) NOT NULL,
    total_price numeric(10,2)
);


ALTER TABLE public.apparatus_item OWNER TO postgres;

--
-- Name: apparatus_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.apparatus_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.apparatus_item_id_seq OWNER TO postgres;

--
-- Name: apparatus_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.apparatus_item_id_seq OWNED BY public.apparatus_item.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    action character varying(60) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(50),
    description text NOT NULL,
    ip_address inet,
    "timestamp" timestamp with time zone NOT NULL,
    user_id bigint
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group (
    id integer NOT NULL,
    name character varying(150) NOT NULL
);


ALTER TABLE public.auth_group OWNER TO postgres;

--
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_group_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group_permissions (
    id bigint NOT NULL,
    group_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_group_permissions OWNER TO postgres;

--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_permission (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    content_type_id integer NOT NULL,
    codename character varying(100) NOT NULL
);


ALTER TABLE public.auth_permission OWNER TO postgres;

--
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: available_apparatus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.available_apparatus (
    id integer NOT NULL,
    apparatus_name character varying(64) NOT NULL,
    available_quantity_pieces integer DEFAULT 0 NOT NULL,
    last_updated date DEFAULT CURRENT_DATE NOT NULL,
    reorder_level integer DEFAULT 0
);


ALTER TABLE public.available_apparatus OWNER TO postgres;

--
-- Name: available_apparatus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.available_apparatus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.available_apparatus_id_seq OWNER TO postgres;

--
-- Name: available_apparatus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.available_apparatus_id_seq OWNED BY public.available_apparatus.id;


--
-- Name: available_chemicals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.available_chemicals (
    id integer NOT NULL,
    chemical_name character varying(64) NOT NULL,
    quantity numeric(10,2) DEFAULT 0 CONSTRAINT available_chemicals_available_quantity_ml_not_null NOT NULL,
    last_updated date DEFAULT CURRENT_DATE NOT NULL,
    reorder_level numeric(10,2) DEFAULT 0,
    unit character varying(2) NOT NULL
);


ALTER TABLE public.available_chemicals OWNER TO postgres;

--
-- Name: available_chemicals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.available_chemicals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.available_chemicals_id_seq OWNER TO postgres;

--
-- Name: available_chemicals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.available_chemicals_id_seq OWNED BY public.available_chemicals.id;


--
-- Name: chemical_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chemical_item (
    id integer NOT NULL,
    stock_register_id integer,
    chemical_name character varying(64) NOT NULL,
    pack_size numeric(10,2) CONSTRAINT chemical_item_quantity_ml_not_null NOT NULL,
    rate numeric(10,2) NOT NULL,
    make character varying(64) NOT NULL,
    unit character varying(2) NOT NULL,
    no_of_packs integer NOT NULL,
    total_quantity numeric(10,2),
    total_price numeric(10,2)
);


ALTER TABLE public.chemical_item OWNER TO postgres;

--
-- Name: chemical_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chemical_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chemical_item_id_seq OWNER TO postgres;

--
-- Name: chemical_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chemical_item_id_seq OWNED BY public.chemical_item.id;


--
-- Name: damaged_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.damaged_entry (
    id integer NOT NULL,
    staff character varying(64) NOT NULL,
    class character varying(64),
    date date NOT NULL,
    details text,
    damage_image character varying(100),
    day_order character varying(4),
    hour integer[]
);


ALTER TABLE public.damaged_entry OWNER TO postgres;

--
-- Name: damaged_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.damaged_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.damaged_entry_id_seq OWNER TO postgres;

--
-- Name: damaged_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.damaged_entry_id_seq OWNED BY public.damaged_entry.id;


--
-- Name: damaged_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.damaged_item (
    id integer NOT NULL,
    damaged_entry_id integer,
    apparatus_name character varying(64) NOT NULL,
    quantity integer NOT NULL,
    caused_by character varying(100)
);


ALTER TABLE public.damaged_item OWNER TO postgres;

--
-- Name: damaged_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.damaged_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.damaged_item_id_seq OWNER TO postgres;

--
-- Name: damaged_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.damaged_item_id_seq OWNED BY public.damaged_item.id;


--
-- Name: degree_class; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.degree_class (
    id bigint NOT NULL,
    degree character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean NOT NULL
);


ALTER TABLE public.degree_class OWNER TO postgres;

--
-- Name: degree_class_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.degree_class ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.degree_class_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_admin_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_admin_log (
    id integer NOT NULL,
    action_time timestamp with time zone NOT NULL,
    object_id text,
    object_repr character varying(200) NOT NULL,
    action_flag smallint NOT NULL,
    change_message text NOT NULL,
    content_type_id integer,
    user_id bigint NOT NULL,
    CONSTRAINT django_admin_log_action_flag_check CHECK ((action_flag >= 0))
);


ALTER TABLE public.django_admin_log OWNER TO postgres;

--
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_admin_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_content_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_content_type (
    id integer NOT NULL,
    app_label character varying(100) NOT NULL,
    model character varying(100) NOT NULL
);


ALTER TABLE public.django_content_type OWNER TO postgres;

--
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_content_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_migrations (
    id bigint NOT NULL,
    app character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);


ALTER TABLE public.django_migrations OWNER TO postgres;

--
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_session (
    session_key character varying(40) NOT NULL,
    session_data text NOT NULL,
    expire_date timestamp with time zone NOT NULL
);


ALTER TABLE public.django_session OWNER TO postgres;

--
-- Name: issue_chemicals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.issue_chemicals (
    id integer NOT NULL,
    ir_id integer NOT NULL,
    chemical_name character varying(64) NOT NULL,
    issued_quantity numeric(10,2) NOT NULL,
    actual_usage numeric(10,2),
    returned_quantity numeric(10,2),
    unit character varying(2) DEFAULT 'ml'::character varying NOT NULL
);


ALTER TABLE public.issue_chemicals OWNER TO postgres;

--
-- Name: issue_chemicals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.issue_chemicals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.issue_chemicals_id_seq OWNER TO postgres;

--
-- Name: issue_chemicals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.issue_chemicals_id_seq OWNED BY public.issue_chemicals.id;


--
-- Name: issue_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.issue_register (
    ir_id integer NOT NULL,
    request_id integer,
    staff_name character varying(100) NOT NULL,
    class character varying(50) NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'Issued'::character varying NOT NULL,
    stock_request_db_id integer,
    request_code character varying(20)
);


ALTER TABLE public.issue_register OWNER TO postgres;

--
-- Name: issue_register_ir_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.issue_register_ir_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.issue_register_ir_id_seq OWNER TO postgres;

--
-- Name: issue_register_ir_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.issue_register_ir_id_seq OWNED BY public.issue_register.ir_id;


--
-- Name: lab_configuration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lab_configuration (
    id bigint NOT NULL,
    use_common_reorder_level boolean NOT NULL,
    common_chemical_reorder_level numeric(10,2) NOT NULL,
    common_apparatus_reorder_level integer NOT NULL
);


ALTER TABLE public.lab_configuration OWNER TO postgres;

--
-- Name: lab_configuration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.lab_configuration ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.lab_configuration_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: low_stock_apparatus; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.low_stock_apparatus (
    id integer NOT NULL,
    apparatus_name character varying(64) NOT NULL,
    current_quantity_pieces integer NOT NULL,
    reorder_level integer NOT NULL,
    last_checked date DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE public.low_stock_apparatus OWNER TO postgres;

--
-- Name: low_stock_apparatus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.low_stock_apparatus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.low_stock_apparatus_id_seq OWNER TO postgres;

--
-- Name: low_stock_apparatus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.low_stock_apparatus_id_seq OWNED BY public.low_stock_apparatus.id;


--
-- Name: low_stock_chemicals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.low_stock_chemicals (
    id integer NOT NULL,
    chemical_name character varying(64) NOT NULL,
    quantity numeric(10,2) CONSTRAINT low_stock_chemicals_current_quantity_ml_not_null NOT NULL,
    reorder_level numeric(10,2) NOT NULL,
    last_checked date DEFAULT CURRENT_DATE NOT NULL,
    unit character varying(2) NOT NULL
);


ALTER TABLE public.low_stock_chemicals OWNER TO postgres;

--
-- Name: low_stock_chemicals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.low_stock_chemicals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.low_stock_chemicals_id_seq OWNER TO postgres;

--
-- Name: low_stock_chemicals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.low_stock_chemicals_id_seq OWNED BY public.low_stock_chemicals.id;


--
-- Name: password_reset_token; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_token (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token character varying(64) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false
);


ALTER TABLE public.password_reset_token OWNER TO postgres;

--
-- Name: password_reset_token_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_token_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_token_id_seq OWNER TO postgres;

--
-- Name: password_reset_token_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_token_id_seq OWNED BY public.password_reset_token.id;


--
-- Name: service_entry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_entry (
    id integer NOT NULL,
    service_code character varying(20) NOT NULL,
    storekeeper character varying(64) NOT NULL,
    service_person_name character varying(64) NOT NULL,
    contact_country_code character varying(5) NOT NULL,
    contact_number character varying(10) NOT NULL,
    email character varying(100),
    deliver_by_date date,
    date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'in_service'::character varying NOT NULL,
    completed_at timestamp without time zone,
    CONSTRAINT chk_contact_number_10digit CHECK (((contact_number)::text ~ '^[0-9]{10}$'::text)),
    CONSTRAINT chk_service_status CHECK (((status)::text = ANY ((ARRAY['in_service'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.service_entry OWNER TO postgres;

--
-- Name: service_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.service_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_entry_id_seq OWNER TO postgres;

--
-- Name: service_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.service_entry_id_seq OWNED BY public.service_entry.id;


--
-- Name: service_entry_item_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_entry_item_logs (
    id integer NOT NULL,
    service_entry_item_id integer NOT NULL,
    action_type character varying(10) NOT NULL,
    quantity integer NOT NULL,
    actioned_by character varying(64) NOT NULL,
    actioned_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_entry_item_logs_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['repaired'::character varying, 'damaged'::character varying])::text[]))),
    CONSTRAINT service_entry_item_logs_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.service_entry_item_logs OWNER TO postgres;

--
-- Name: service_entry_item_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.service_entry_item_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_entry_item_logs_id_seq OWNER TO postgres;

--
-- Name: service_entry_item_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.service_entry_item_logs_id_seq OWNED BY public.service_entry_item_logs.id;


--
-- Name: service_entry_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_entry_items (
    id integer NOT NULL,
    service_entry_id integer NOT NULL,
    apparatus_name character varying(64) NOT NULL,
    quantity_sent integer NOT NULL,
    quantity_remaining integer NOT NULL,
    quantity_repaired integer DEFAULT 0 NOT NULL,
    quantity_damaged integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_qty_sum_consistent CHECK ((((quantity_remaining + quantity_repaired) + quantity_damaged) = quantity_sent)),
    CONSTRAINT chk_remaining_non_negative CHECK ((quantity_remaining >= 0)),
    CONSTRAINT service_entry_items_quantity_sent_check CHECK ((quantity_sent > 0))
);


ALTER TABLE public.service_entry_items OWNER TO postgres;

--
-- Name: service_entry_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.service_entry_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.service_entry_items_id_seq OWNER TO postgres;

--
-- Name: service_entry_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.service_entry_items_id_seq OWNED BY public.service_entry_items.id;


--
-- Name: stock_register; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_register (
    id integer NOT NULL,
    invoice_number character varying(32) NOT NULL,
    date date NOT NULL,
    supplier_name character varying(100) NOT NULL,
    invoice_file character varying(100),
    remarks text NOT NULL,
    supplier_contact_country_code character varying(5),
    supplier_contact_phone character varying(15),
    supplier_email character varying(128)
);


ALTER TABLE public.stock_register OWNER TO postgres;

--
-- Name: stock_register_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_register_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_register_id_seq OWNER TO postgres;

--
-- Name: stock_register_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_register_id_seq OWNED BY public.stock_register.id;


--
-- Name: stock_request; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_request (
    id bigint NOT NULL,
    status character varying(20) NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    reviewed_at timestamp with time zone,
    requested_by_id bigint NOT NULL,
    reviewed_by_id bigint,
    class_name character varying(50) NOT NULL,
    date date NOT NULL,
    request_id character varying(20) NOT NULL,
    viewed_by_requester boolean NOT NULL,
    completed_at timestamp with time zone,
    issued_at timestamp with time zone,
    issued_by_id bigint,
    reported_at timestamp with time zone,
    rejection_reason text NOT NULL,
    cancelled_at timestamp with time zone,
    day_order character varying(4),
    hour integer[],
    purpose_type character varying(20),
    experiment_name text,
    student_name character varying(128)
);


ALTER TABLE public.stock_request OWNER TO postgres;

--
-- Name: stock_request_apparatus_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_request_apparatus_item (
    id bigint NOT NULL,
    apparatus_name character varying(64) NOT NULL,
    quantity_pieces integer NOT NULL,
    stock_request_id bigint NOT NULL
);


ALTER TABLE public.stock_request_apparatus_item OWNER TO postgres;

--
-- Name: stock_request_apparatus_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_request_apparatus_item ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stock_request_apparatus_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_request_chemical_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_request_chemical_item (
    id bigint NOT NULL,
    chemical_name character varying(64) NOT NULL,
    quantity numeric(10,2) CONSTRAINT stock_request_chemical_item_quantity_ml_not_null NOT NULL,
    stock_request_id bigint NOT NULL,
    actual_used_quantity numeric(10,2),
    returned_quantity_ml numeric(10,2),
    unit character varying(2) NOT NULL
);


ALTER TABLE public.stock_request_chemical_item OWNER TO postgres;

--
-- Name: stock_request_chemical_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_request_chemical_item ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stock_request_chemical_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_request_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_request ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stock_request_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: token_blacklist_blacklistedtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_blacklistedtoken (
    id bigint NOT NULL,
    blacklisted_at timestamp with time zone NOT NULL,
    token_id bigint NOT NULL
);


ALTER TABLE public.token_blacklist_blacklistedtoken OWNER TO postgres;

--
-- Name: token_blacklist_blacklistedtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.token_blacklist_blacklistedtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.token_blacklist_blacklistedtoken_id_seq OWNER TO postgres;

--
-- Name: token_blacklist_blacklistedtoken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.token_blacklist_blacklistedtoken_id_seq OWNED BY public.token_blacklist_blacklistedtoken.id;


--
-- Name: token_blacklist_outstandingtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_outstandingtoken (
    id bigint NOT NULL,
    jti character varying(255) NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    user_id bigint NOT NULL
);


ALTER TABLE public.token_blacklist_outstandingtoken OWNER TO postgres;

--
-- Name: token_blacklist_outstandingtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.token_blacklist_outstandingtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.token_blacklist_outstandingtoken_id_seq OWNER TO postgres;

--
-- Name: token_blacklist_outstandingtoken_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.token_blacklist_outstandingtoken_id_seq OWNED BY public.token_blacklist_outstandingtoken.id;


--
-- Name: user_account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_account (
    id bigint NOT NULL,
    employee_id character varying(20) NOT NULL,
    password character varying(128) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(13) NOT NULL,
    role character varying(20) NOT NULL,
    designation character varying(50) NOT NULL,
    department character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    is_staff boolean DEFAULT false,
    is_superuser boolean DEFAULT false,
    password_must_change boolean DEFAULT true,
    last_password_change timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    account_locked_until timestamp without time zone,
    date_joined timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    created_by_id bigint,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    degree character varying(50),
    is_first_login boolean NOT NULL,
    CONSTRAINT chk_department CHECK (((department)::text = ANY (ARRAY[('B.Sc Chemistry'::character varying)::text, ('M.Sc Chemistry'::character varying)::text]))),
    CONSTRAINT chk_role CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('hod'::character varying)::text, ('store_keeper'::character varying)::text, ('staff'::character varying)::text])))
);


ALTER TABLE public.user_account OWNER TO postgres;

--
-- Name: user_account_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_account_groups (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.user_account_groups OWNER TO postgres;

--
-- Name: user_account_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_account_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_account_groups_id_seq OWNER TO postgres;

--
-- Name: user_account_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_account_groups_id_seq OWNED BY public.user_account_groups.id;


--
-- Name: user_account_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_account_id_seq OWNER TO postgres;

--
-- Name: user_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_account_id_seq OWNED BY public.user_account.id;


--
-- Name: user_account_user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_account_user_permissions (
    id integer NOT NULL,
    user_id bigint NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.user_account_user_permissions OWNER TO postgres;

--
-- Name: user_account_user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_account_user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_account_user_permissions_id_seq OWNER TO postgres;

--
-- Name: user_account_user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_account_user_permissions_id_seq OWNED BY public.user_account_user_permissions.id;


--
-- Name: apparatus_item id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apparatus_item ALTER COLUMN id SET DEFAULT nextval('public.apparatus_item_id_seq'::regclass);


--
-- Name: available_apparatus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_apparatus ALTER COLUMN id SET DEFAULT nextval('public.available_apparatus_id_seq'::regclass);


--
-- Name: available_chemicals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_chemicals ALTER COLUMN id SET DEFAULT nextval('public.available_chemicals_id_seq'::regclass);


--
-- Name: chemical_item id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chemical_item ALTER COLUMN id SET DEFAULT nextval('public.chemical_item_id_seq'::regclass);


--
-- Name: damaged_entry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.damaged_entry ALTER COLUMN id SET DEFAULT nextval('public.damaged_entry_id_seq'::regclass);


--
-- Name: damaged_item id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.damaged_item ALTER COLUMN id SET DEFAULT nextval('public.damaged_item_id_seq'::regclass);


--
-- Name: issue_chemicals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issue_chemicals ALTER COLUMN id SET DEFAULT nextval('public.issue_chemicals_id_seq'::regclass);


--
-- Name: issue_register ir_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issue_register ALTER COLUMN ir_id SET DEFAULT nextval('public.issue_register_ir_id_seq'::regclass);


--
-- Name: low_stock_apparatus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_apparatus ALTER COLUMN id SET DEFAULT nextval('public.low_stock_apparatus_id_seq'::regclass);


--
-- Name: low_stock_chemicals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_chemicals ALTER COLUMN id SET DEFAULT nextval('public.low_stock_chemicals_id_seq'::regclass);


--
-- Name: password_reset_token id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_token ALTER COLUMN id SET DEFAULT nextval('public.password_reset_token_id_seq'::regclass);


--
-- Name: service_entry id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry ALTER COLUMN id SET DEFAULT nextval('public.service_entry_id_seq'::regclass);


--
-- Name: service_entry_item_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_item_logs ALTER COLUMN id SET DEFAULT nextval('public.service_entry_item_logs_id_seq'::regclass);


--
-- Name: service_entry_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_items ALTER COLUMN id SET DEFAULT nextval('public.service_entry_items_id_seq'::regclass);


--
-- Name: stock_register id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_register ALTER COLUMN id SET DEFAULT nextval('public.stock_register_id_seq'::regclass);


--
-- Name: token_blacklist_blacklistedtoken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken ALTER COLUMN id SET DEFAULT nextval('public.token_blacklist_blacklistedtoken_id_seq'::regclass);


--
-- Name: token_blacklist_outstandingtoken id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken ALTER COLUMN id SET DEFAULT nextval('public.token_blacklist_outstandingtoken_id_seq'::regclass);


--
-- Name: user_account id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account ALTER COLUMN id SET DEFAULT nextval('public.user_account_id_seq'::regclass);


--
-- Name: user_account_groups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_groups ALTER COLUMN id SET DEFAULT nextval('public.user_account_groups_id_seq'::regclass);


--
-- Name: user_account_user_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_account_user_permissions_id_seq'::regclass);


--
-- Name: apparatus_item apparatus_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apparatus_item
    ADD CONSTRAINT apparatus_item_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_group auth_group_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_name_key UNIQUE (name);


--
-- Name: auth_group_permissions auth_group_permissions_group_id_permission_id_0cd325b0_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id);


--
-- Name: auth_group_permissions auth_group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id);


--
-- Name: auth_group auth_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_pkey PRIMARY KEY (id);


--
-- Name: auth_permission auth_permission_content_type_id_codename_01ab375a_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename);


--
-- Name: auth_permission auth_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_pkey PRIMARY KEY (id);


--
-- Name: available_apparatus available_apparatus_apparatus_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_apparatus
    ADD CONSTRAINT available_apparatus_apparatus_name_key UNIQUE (apparatus_name);


--
-- Name: available_apparatus available_apparatus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_apparatus
    ADD CONSTRAINT available_apparatus_pkey PRIMARY KEY (id);


--
-- Name: available_chemicals available_chemicals_chemical_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_chemicals
    ADD CONSTRAINT available_chemicals_chemical_name_key UNIQUE (chemical_name);


--
-- Name: available_chemicals available_chemicals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.available_chemicals
    ADD CONSTRAINT available_chemicals_pkey PRIMARY KEY (id);


--
-- Name: chemical_item chemical_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chemical_item
    ADD CONSTRAINT chemical_item_pkey PRIMARY KEY (id);


--
-- Name: damaged_entry damaged_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.damaged_entry
    ADD CONSTRAINT damaged_entry_pkey PRIMARY KEY (id);


--
-- Name: damaged_item damaged_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.damaged_item
    ADD CONSTRAINT damaged_item_pkey PRIMARY KEY (id);


--
-- Name: degree_class degree_class_degree_name_0f158428_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.degree_class
    ADD CONSTRAINT degree_class_degree_name_0f158428_uniq UNIQUE (degree, name);


--
-- Name: degree_class degree_class_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.degree_class
    ADD CONSTRAINT degree_class_pkey PRIMARY KEY (id);


--
-- Name: django_admin_log django_admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_pkey PRIMARY KEY (id);


--
-- Name: django_content_type django_content_type_app_label_model_76bd3d3b_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model);


--
-- Name: django_content_type django_content_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_pkey PRIMARY KEY (id);


--
-- Name: django_migrations django_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_migrations
    ADD CONSTRAINT django_migrations_pkey PRIMARY KEY (id);


--
-- Name: django_session django_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_session
    ADD CONSTRAINT django_session_pkey PRIMARY KEY (session_key);


--
-- Name: issue_chemicals issue_chemicals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issue_chemicals
    ADD CONSTRAINT issue_chemicals_pkey PRIMARY KEY (id);


--
-- Name: issue_register issue_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issue_register
    ADD CONSTRAINT issue_register_pkey PRIMARY KEY (ir_id);


--
-- Name: lab_configuration lab_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lab_configuration
    ADD CONSTRAINT lab_configuration_pkey PRIMARY KEY (id);


--
-- Name: low_stock_apparatus low_stock_apparatus_apparatus_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_apparatus
    ADD CONSTRAINT low_stock_apparatus_apparatus_name_key UNIQUE (apparatus_name);


--
-- Name: low_stock_apparatus low_stock_apparatus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_apparatus
    ADD CONSTRAINT low_stock_apparatus_pkey PRIMARY KEY (id);


--
-- Name: low_stock_chemicals low_stock_chemicals_chemical_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_chemicals
    ADD CONSTRAINT low_stock_chemicals_chemical_name_key UNIQUE (chemical_name);


--
-- Name: low_stock_chemicals low_stock_chemicals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.low_stock_chemicals
    ADD CONSTRAINT low_stock_chemicals_pkey PRIMARY KEY (id);


--
-- Name: password_reset_token password_reset_token_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_token
    ADD CONSTRAINT password_reset_token_pkey PRIMARY KEY (id);


--
-- Name: password_reset_token password_reset_token_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_token
    ADD CONSTRAINT password_reset_token_token_key UNIQUE (token);


--
-- Name: service_entry_item_logs service_entry_item_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_item_logs
    ADD CONSTRAINT service_entry_item_logs_pkey PRIMARY KEY (id);


--
-- Name: service_entry_items service_entry_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_items
    ADD CONSTRAINT service_entry_items_pkey PRIMARY KEY (id);


--
-- Name: service_entry service_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry
    ADD CONSTRAINT service_entry_pkey PRIMARY KEY (id);


--
-- Name: service_entry service_entry_service_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry
    ADD CONSTRAINT service_entry_service_code_key UNIQUE (service_code);


--
-- Name: stock_register stock_register_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_register
    ADD CONSTRAINT stock_register_invoice_number_key UNIQUE (invoice_number);


--
-- Name: stock_register stock_register_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_register
    ADD CONSTRAINT stock_register_pkey PRIMARY KEY (id);


--
-- Name: stock_request_apparatus_item stock_request_apparatus_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_apparatus_item
    ADD CONSTRAINT stock_request_apparatus_item_pkey PRIMARY KEY (id);


--
-- Name: stock_request_chemical_item stock_request_chemical_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_chemical_item
    ADD CONSTRAINT stock_request_chemical_item_pkey PRIMARY KEY (id);


--
-- Name: stock_request stock_request_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request
    ADD CONSTRAINT stock_request_pkey PRIMARY KEY (id);


--
-- Name: stock_request stock_request_request_id_9d690165_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request
    ADD CONSTRAINT stock_request_request_id_9d690165_uniq UNIQUE (request_id);


--
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_pkey PRIMARY KEY (id);


--
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_key UNIQUE (token_id);


--
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_jti_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_jti_key UNIQUE (jti);


--
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_pkey PRIMARY KEY (id);


--
-- Name: user_account user_account_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account
    ADD CONSTRAINT user_account_email_key UNIQUE (email);


--
-- Name: user_account user_account_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account
    ADD CONSTRAINT user_account_employee_id_key UNIQUE (employee_id);


--
-- Name: user_account_groups user_account_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_groups
    ADD CONSTRAINT user_account_groups_pkey PRIMARY KEY (id);


--
-- Name: user_account_groups user_account_groups_user_id_group_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_groups
    ADD CONSTRAINT user_account_groups_user_id_group_id_key UNIQUE (user_id, group_id);


--
-- Name: user_account user_account_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account
    ADD CONSTRAINT user_account_phone_key UNIQUE (phone);


--
-- Name: user_account user_account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account
    ADD CONSTRAINT user_account_pkey PRIMARY KEY (id);


--
-- Name: user_account_user_permissions user_account_user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_user_permissions
    ADD CONSTRAINT user_account_user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_account_user_permissions user_account_user_permissions_user_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_user_permissions
    ADD CONSTRAINT user_account_user_permissions_user_id_permission_id_key UNIQUE (user_id, permission_id);


--
-- Name: audit_log_user_id_a1b3392d; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_user_id_a1b3392d ON public.audit_log USING btree (user_id);


--
-- Name: auth_group_name_a6ea08ec_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_name_a6ea08ec_like ON public.auth_group USING btree (name varchar_pattern_ops);


--
-- Name: auth_group_permissions_group_id_b120cbf9; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_group_id_b120cbf9 ON public.auth_group_permissions USING btree (group_id);


--
-- Name: auth_group_permissions_permission_id_84c5c92e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_permission_id_84c5c92e ON public.auth_group_permissions USING btree (permission_id);


--
-- Name: auth_permission_content_type_id_2f476e4b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_permission_content_type_id_2f476e4b ON public.auth_permission USING btree (content_type_id);


--
-- Name: django_admin_log_content_type_id_c4bce8eb; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_content_type_id_c4bce8eb ON public.django_admin_log USING btree (content_type_id);


--
-- Name: django_admin_log_user_id_c564eba6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_user_id_c564eba6 ON public.django_admin_log USING btree (user_id);


--
-- Name: django_session_expire_date_a5c62663; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_expire_date_a5c62663 ON public.django_session USING btree (expire_date);


--
-- Name: django_session_session_key_c0390e0f_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_session_key_c0390e0f_like ON public.django_session USING btree (session_key varchar_pattern_ops);


--
-- Name: idx_issue_chemicals_ir_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_issue_chemicals_ir_id ON public.issue_chemicals USING btree (ir_id);


--
-- Name: idx_issue_register_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_issue_register_request_id ON public.issue_register USING btree (request_id);


--
-- Name: idx_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reset_token ON public.password_reset_token USING btree (token);


--
-- Name: idx_reset_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reset_user ON public.password_reset_token USING btree (user_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_email ON public.user_account USING btree (email);


--
-- Name: idx_user_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_employee_id ON public.user_account USING btree (employee_id);


--
-- Name: idx_user_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_is_active ON public.user_account USING btree (is_active);


--
-- Name: idx_user_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_role ON public.user_account USING btree (role);


--
-- Name: stock_request_apparatus_item_stock_request_id_e10ac9f8; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_apparatus_item_stock_request_id_e10ac9f8 ON public.stock_request_apparatus_item USING btree (stock_request_id);


--
-- Name: stock_request_chemical_item_stock_request_id_7bcc9bef; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_chemical_item_stock_request_id_7bcc9bef ON public.stock_request_chemical_item USING btree (stock_request_id);


--
-- Name: stock_request_issued_by_id_3d3c748e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_issued_by_id_3d3c748e ON public.stock_request USING btree (issued_by_id);


--
-- Name: stock_request_request_id_9d690165_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_request_id_9d690165_like ON public.stock_request USING btree (request_id varchar_pattern_ops);


--
-- Name: stock_request_requested_by_id_a5235674; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_requested_by_id_a5235674 ON public.stock_request USING btree (requested_by_id);


--
-- Name: stock_request_reviewed_by_id_d1e31301; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_request_reviewed_by_id_d1e31301 ON public.stock_request USING btree (reviewed_by_id);


--
-- Name: token_blacklist_outstandingtoken_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_blacklist_outstandingtoken_user_id_idx ON public.token_blacklist_outstandingtoken USING btree (user_id);


--
-- Name: user_account_one_hod; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_account_one_hod ON public.user_account USING btree (role) WHERE ((role)::text = 'hod'::text);


--
-- Name: user_account_one_store_keeper; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_account_one_store_keeper ON public.user_account USING btree (role) WHERE ((role)::text = 'store_keeper'::text);


--
-- Name: apparatus_item apparatus_item_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER apparatus_item_after_insert AFTER INSERT ON public.apparatus_item FOR EACH ROW EXECUTE FUNCTION public.update_available_apparatus();


--
-- Name: chemical_item chemical_item_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER chemical_item_after_insert AFTER INSERT ON public.chemical_item FOR EACH ROW EXECUTE FUNCTION public.update_available_chemicals();


--
-- Name: damaged_item damaged_item_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER damaged_item_after_insert AFTER INSERT ON public.damaged_item FOR EACH ROW EXECUTE FUNCTION public.subtract_damaged_apparatus_item();


--
-- Name: user_account enforce_single_hod; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_single_hod BEFORE INSERT OR UPDATE ON public.user_account FOR EACH ROW EXECUTE FUNCTION public.check_single_hod();


--
-- Name: service_entry_item_logs trg_service_action_apply; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_service_action_apply BEFORE INSERT ON public.service_entry_item_logs FOR EACH ROW EXECUTE FUNCTION public.fn_service_action_apply();


--
-- Name: service_entry_items trg_service_item_sent; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_service_item_sent AFTER INSERT ON public.service_entry_items FOR EACH ROW EXECUTE FUNCTION public.fn_service_item_sent_decrement();


--
-- Name: available_apparatus trigger_low_stock_apparatus; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_low_stock_apparatus AFTER UPDATE ON public.available_apparatus FOR EACH ROW EXECUTE FUNCTION public.check_low_stock_apparatus();


--
-- Name: available_chemicals trigger_low_stock_chemicals; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_low_stock_chemicals AFTER UPDATE ON public.available_chemicals FOR EACH ROW EXECUTE FUNCTION public.check_low_stock_chemicals();


--
-- Name: user_account update_user_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON public.user_account FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: apparatus_item apparatus_item_stock_register_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apparatus_item
    ADD CONSTRAINT apparatus_item_stock_register_fk FOREIGN KEY (stock_register_id) REFERENCES public.stock_register(id);


--
-- Name: apparatus_item apparatus_item_stock_register_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apparatus_item
    ADD CONSTRAINT apparatus_item_stock_register_id_fkey FOREIGN KEY (stock_register_id) REFERENCES public.stock_register(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_a1b3392d_fk_user_account_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_a1b3392d_fk_user_account_id FOREIGN KEY (user_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_group_permissions auth_group_permissio_permission_id_84c5c92e_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_group_permissions auth_group_permissions_group_id_b120cbf9_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_permission auth_permission_content_type_id_2f476e4b_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: chemical_item chemical_item_stock_register_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chemical_item
    ADD CONSTRAINT chemical_item_stock_register_fk FOREIGN KEY (stock_register_id) REFERENCES public.stock_register(id);


--
-- Name: chemical_item chemical_item_stock_register_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chemical_item
    ADD CONSTRAINT chemical_item_stock_register_id_fkey FOREIGN KEY (stock_register_id) REFERENCES public.stock_register(id) ON DELETE CASCADE;


--
-- Name: damaged_item damaged_item_damaged_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.damaged_item
    ADD CONSTRAINT damaged_item_damaged_entry_id_fkey FOREIGN KEY (damaged_entry_id) REFERENCES public.damaged_entry(id) ON DELETE CASCADE;


--
-- Name: django_admin_log django_admin_log_content_type_id_c4bce8eb_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_user_id_c564eba6_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_user_id_c564eba6_fk FOREIGN KEY (user_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: issue_chemicals issue_chemicals_ir_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.issue_chemicals
    ADD CONSTRAINT issue_chemicals_ir_id_fkey FOREIGN KEY (ir_id) REFERENCES public.issue_register(ir_id) ON DELETE CASCADE;


--
-- Name: password_reset_token password_reset_token_user_id_4982bbf6_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_token
    ADD CONSTRAINT password_reset_token_user_id_4982bbf6_fk FOREIGN KEY (user_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: service_entry_item_logs service_entry_item_logs_service_entry_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_item_logs
    ADD CONSTRAINT service_entry_item_logs_service_entry_item_id_fkey FOREIGN KEY (service_entry_item_id) REFERENCES public.service_entry_items(id) ON DELETE CASCADE;


--
-- Name: service_entry_items service_entry_items_service_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_entry_items
    ADD CONSTRAINT service_entry_items_service_entry_id_fkey FOREIGN KEY (service_entry_id) REFERENCES public.service_entry(id) ON DELETE CASCADE;


--
-- Name: stock_request_apparatus_item stock_request_appara_stock_request_id_e10ac9f8_fk_stock_req; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_apparatus_item
    ADD CONSTRAINT stock_request_appara_stock_request_id_e10ac9f8_fk_stock_req FOREIGN KEY (stock_request_id) REFERENCES public.stock_request(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: stock_request_chemical_item stock_request_chemic_stock_request_id_7bcc9bef_fk_stock_req; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request_chemical_item
    ADD CONSTRAINT stock_request_chemic_stock_request_id_7bcc9bef_fk_stock_req FOREIGN KEY (stock_request_id) REFERENCES public.stock_request(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: stock_request stock_request_issued_by_id_3d3c748e_fk_user_account_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request
    ADD CONSTRAINT stock_request_issued_by_id_3d3c748e_fk_user_account_id FOREIGN KEY (issued_by_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: stock_request stock_request_requested_by_id_a5235674_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request
    ADD CONSTRAINT stock_request_requested_by_id_a5235674_fk FOREIGN KEY (requested_by_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: stock_request stock_request_reviewed_by_id_d1e31301_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_request
    ADD CONSTRAINT stock_request_reviewed_by_id_d1e31301_fk FOREIGN KEY (reviewed_by_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.token_blacklist_outstandingtoken(id);


--
-- Name: user_account user_account_created_by_id_fd73a650_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account
    ADD CONSTRAINT user_account_created_by_id_fd73a650_fk FOREIGN KEY (created_by_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: user_account_groups user_account_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_groups
    ADD CONSTRAINT user_account_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.auth_group(id) ON DELETE CASCADE;


--
-- Name: user_account_groups user_account_groups_user_id_bed2d356_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_groups
    ADD CONSTRAINT user_account_groups_user_id_bed2d356_fk FOREIGN KEY (user_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: user_account_user_permissions user_account_user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_user_permissions
    ADD CONSTRAINT user_account_user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) ON DELETE CASCADE;


--
-- Name: user_account_user_permissions user_account_user_permissions_user_id_5e745117_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_account_user_permissions
    ADD CONSTRAINT user_account_user_permissions_user_id_5e745117_fk FOREIGN KEY (user_id) REFERENCES public.user_account(id) DEFERRABLE INITIALLY DEFERRED;


--
-- PostgreSQL database dump complete
--

\unrestrict xyL2bjEujeCpi2knhpwYij4L2eaJK5fcZ80LjdAj2QwEvGkEMOqS7V7Rg1EILCk

