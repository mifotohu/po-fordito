
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Projekt ID szükséges' }, { status: 400 });
    }

    const project = await prisma.translationProject.findUnique({
      where: { id: projectId },
      include: {
        entries: {
          select: {
            id: true,
            lineNumber: true,
            msgid: true,
            msgstr: true,
            translatedMsgstr: true,
            isTranslated: true,
            hasError: true,
            errorMessage: true,
            characterCount: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Projekt nem található' }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      fileName: project.fileName,
      sourceLang: project.sourceLang,
      status: project.status,
      totalEntries: project.totalEntries,
      translatedEntries: project.translatedEntries,
      errorMessage: project.errorMessage,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      entries: project.entries
    });

  } catch (error) {
    console.error('Project fetch error:', error);
    return NextResponse.json(
      { error: 'Hiba a projekt betöltése során' }, 
      { status: 500 }
    );
  }
}
