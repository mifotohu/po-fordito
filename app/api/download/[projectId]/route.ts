
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generatePoFile } from '@/lib/po-parser';
import { uploadFile } from '@/lib/s3';

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

    // Get project with translated entries
    const project = await prisma.translationProject.findUnique({
      where: { id: projectId },
      include: { entries: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Projekt nem található' }, { status: 404 });
    }

    // Convert database entries back to PoEntry format
    const poEntries = project.entries?.map(entry => ({
      lineNumber: entry.lineNumber,
      comment: entry.comment ?? undefined,
      msgid: entry.msgid,
      msgstr: entry.translatedMsgstr || entry.msgstr || '',
      characterCount: entry.characterCount
    })) ?? [];

    // Generate .po file content
    const poFileContent = generatePoFile(poEntries, '');

    // Create filename for translated file
    const originalName = project.fileName;
    const translatedName = originalName.replace('.po', '_hu.po');

    // Upload translated file to S3
    const buffer = Buffer.from(poFileContent, 'utf-8');
    const translatedFilePath = await uploadFile(buffer, translatedName);

    // Update project with translated file path
    await prisma.translationProject.update({
      where: { id: projectId },
      data: { translatedFilePath }
    });

    // Return file content as response
    return new Response(poFileContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${translatedName}"`,
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Hiba a fájl letöltése során' }, 
      { status: 500 }
    );
  }
}
