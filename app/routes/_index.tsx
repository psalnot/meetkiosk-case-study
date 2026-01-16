import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { parseDsnFile } from "~/utils/dsn-parser/parser.server";
import { loadQuestionsFromCsv } from "~/utils/questions/loader.server";
//import QuestionnaireForm from "~/components/questionnaire-form";
import { computeAnswers } from "~/utils/matching/index.server";
import indexStyles from "~/styles/index.css";
import { commitSession, getSession } from "../utils/sessions/sessions.server";

/**
 * ActionData represents all possible JSON responses returned by the action().
 * 
 * - Error case: returned when validation or parsing fails
 * - Success case: returned when DSN is successfully processed with full questionnaire data
 */
type ActionData =
  | { error: string }
  | { 
      success: true; 
      dsnPeriod: string;
      questions: import("~/utils/questions/types").Question[];
      answers: Record<string, import("~/utils/matching/types.server").Answer>;
    };


export const links: LinksFunction = () => [
    { rel: "stylesheet", href: indexStyles },
  ];
  


export const meta: MetaFunction = () => {
  return [{ title: "Kiosk ESG/CSRD Assistant" }];
};


export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const dsnFile = formData.get("dsn") as File | null;

  if (!dsnFile || dsnFile.size === 0) {
    return json({ error: "Please upload a DSN file (.txt)." }, { status: 400 });
  }
  if (dsnFile.size > 10000000) { // 10MB limit
    return json({ error: "File too large (Maximum size 10MB) " }, { status: 400 });
  }


  // Validate file type (basic check)
  if (!dsnFile.name.endsWith(".txt")) {
    return json({ error: "Only .txt files are allowed." }, { status: 400 });
  }

  try {
    const content = await dsnFile.text();
    const declaration = await parseDsnFile(content); 
    const questions = loadQuestionsFromCsv();
    const answers = computeAnswers(declaration, questions);



    //Format declaration date for UI
    const rawPeriod = declaration.mois; // "19460720"
    let formattedDate = "Unknown";

    if (rawPeriod && /^\d{6,8}$/.test(rawPeriod)) {
      const yyyymm = rawPeriod.length === 8 ? rawPeriod.substring(0, 6) : rawPeriod;
      const year = yyyymm.substring(0, 4);
      const month = parseInt(yyyymm.substring(4, 6), 10) - 1; // JS months are 0-indexed
      const day =
            rawPeriod.length === 8
              ? parseInt(rawPeriod.substring(6, 8), 10)
              : 1; // default day if missing
      
      const date = new Date(year, month, day);
      formattedDate = date.toLocaleString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        }); // i.e : Jul 20, 2024
    }

    
    //Session management
    // Store in memory session (not cookie)
    const session = await getSession(request.headers.get("Cookie"));
    session.set("questionnaireData", { 
      declarationDate: formattedDate,
      questionTree: questions,
      answers 
    });

    return redirect("/questionnaire", {
      headers: { "Set-Cookie": await commitSession(session) }
    });
     

  } catch (err) {
    if (err instanceof Error) {
      // Known, user-facing error
      return json({ error: err.message }, { status: 400 });
    }

    // Unknown / system error → log everything
    console.error("Unexpected DSN upload error", {
      err,
      timestamp: new Date().toISOString(),
    });

    return json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
    
    //return json({ error: err.message || "Failed to parse DSN file." }, { status: 400 });
  }
}

export default function Index() {
  
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";



  return (
    <div className="page">
      <h1>Kiosk ESG/CSRD Assistant</h1>
      <p>Upload your DSN declaration to auto-fill ESG reporting answers.</p>



      <Form method="post" encType="multipart/form-data" className="form">
        <label htmlFor="dsn-upload">
          DSN File (.txt):
        </label>
        <input
          id="dsn-upload"
          type="file"
          name="dsn"
          accept=".txt,text/plain"
          required
          className="input"
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="button"
        >
          {isSubmitting ? "Uploading…" : "Upload & Parse"}
        </button>
      </Form>

      {actionData?.error && (
        <div
          className="alert alert-error"
          
        >
          ❌ {actionData.error}
        </div>
      )}

      
    </div>
  );
}