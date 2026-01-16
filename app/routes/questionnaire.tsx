import { useEffect } from "react";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { LinksFunction, useLoaderData, Link } from "@remix-run/react";
import { getSession } from "~/utils/sessions/sessions.server";
import { QuestionnaireFormData } from "~/components/questionnaire-form";
import QuestionnaireForm from "~/components/questionnaire-form";
import indexStyles from "~/styles/index.css";





export const links = () => [
  { rel: "stylesheet", href: indexStyles },
];





export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const data = session.get("questionnaireData");
  
  if (!data) {
    return json(null, { status: 302, headers: { Location: "/" } });
  }
  
  return json(data);
}

export default function QuestionnairePage() {

  // This forces Remix to generate client bundles
  useEffect(() => {}, []);

  const data = useLoaderData<typeof loader>();
  
  if (!data) return null;

  // Validate required data
  if (!data.declarationDate || !data.questionTree || !data.answers) {
    console.error("❌ Missing required data");
    return <div>Missing required data</div>;
  }

  // Validate required data
  if (!data.declarationDate || !data.questionTree || !data.answers) {
    console.error("❌ Missing required data:", { 
      declarationDate: data.declarationDate,
      questionTree: data.questionTree?.length,
      answers: data.answers ? Object.keys(data.answers).length : 0
    });
    return <div>Missing required data</div>;
  }


  //Debug answsers
  //console.log("Answers object:", data.answers);
  
  // ✅ Pass questionTree instead of flat questions
  const formData: QuestionnaireFormData = {
    declarationDate: data.declarationDate,
    questionTree: data.questionTree, // ← Updated property name
    answers: data.answers
  };

  return (
    
    <>
      {/* ✅ Back button outside main content */}
      <div className="back-link-top">
        <Link to="/" className="button button-secondary">
          ← Back to Upload
        </Link>
      </div>
      
      <QuestionnaireForm data={formData} />

      <div className="back-link-top">
        <Link to="/" className="button button-secondary">
          ← Back to Upload
        </Link>
      </div>
        
      
    </>
  );
}
