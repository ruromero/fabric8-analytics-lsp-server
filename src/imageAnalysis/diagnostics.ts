/* --------------------------------------------------------------------------------------------
 * Copyright (c) Red Hat
 * Licensed under the Apache-2.0 License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { Diagnostic } from 'vscode-languageserver';

import { connection } from '../server';
import { decodeUriPath } from '../utils';
import { IImageProvider, ImageMap, getRange } from '../imageAnalysis/collector';
import { AbstractDiagnosticsPipeline } from '../diagnosticsPipeline';
import { clearCodeActionsMap, registerCodeAction, generateRedirectToRecommendedVersionAction } from '../codeActionHandler';
import { executeImageAnalysis, ImageData } from './analysis';
import { Vulnerability } from '../vulnerability';

/**
 * Implementation of DiagnosticsPipeline interface.
 * @typeparam ImageData - The type of elements in the image data array.
 */
class DiagnosticsPipeline extends AbstractDiagnosticsPipeline<ImageData> {

    /**
     * Creates an instance of DiagnosticsPipeline.
     * @param imageMap - The image map containing information about image derived from the image file.
     * @param diagnosticFilePath - The path to the image file to retrieve diagnostics from.
     */
    constructor(private imageMap: ImageMap, diagnosticFilePath: string) {
        super(diagnosticFilePath);
    }

    /**
     * Runs diagnostics on images.
     * @param images - A map containing image data by reference string.
     */
    runDiagnostics(images: Map<string, ImageData[]>) {
        Object.entries(images).map(([ref, imageData]: [string, ImageData[]]) => {
            const foundImageList = this.imageMap.get(ref);

            foundImageList.forEach(image => {

                const vulnerability = new Vulnerability(
                    getRange(image),
                    image.name.value,
                    imageData,
                );
                
                const vulnerabilityDiagnostic = vulnerability.getDiagnostic();
                this.diagnostics.push(vulnerabilityDiagnostic);

                const loc = vulnerabilityDiagnostic.range.start.line + '|' + vulnerabilityDiagnostic.range.start.character;

                imageData.forEach(id => {
    
                    if (id.recommendationRef) {
                        this.createCodeAction(loc, id.recommendationRef, id.sourceId, vulnerabilityDiagnostic);
                    }
    
                    const vulnProvider = id.sourceId.split('(')[0];
                    const issuesCount = id.issuesCount;
                    this.vulnCount[vulnProvider] = (this.vulnCount[vulnProvider] || 0) + issuesCount;
                });      
                connection.sendDiagnostics({ uri: this.diagnosticFilePath, diagnostics: this.diagnostics });
            });
        });
    }

    /**
     * Creates a code action.
     * @param loc - Location of code action effect.
     * @param imageRef - The reference name of the image.
     * @param sourceId - Source ID.
     * @param vulnerabilityDiagnostic - Vulnerability diagnostic object.
     * @private
     */
    private createCodeAction(loc: string, imageRef: string, sourceId: string, vulnerabilityDiagnostic: Diagnostic) {
        const title = `${sourceId}: Switch to Red Hat UBI ${imageRef} for enhanced security and enterprise-grade stability`;
        const codeAction = generateRedirectToRecommendedVersionAction(title, imageRef, vulnerabilityDiagnostic, this.diagnosticFilePath);
        registerCodeAction(this.diagnosticFilePath, loc, codeAction);
    }
}

/**
 * Performs diagnostics on the provided image file contents.
 * @param diagnosticFilePath - The path to the image file.
 * @param contents - The contents of the image file.
 * @param provider - The image provider of the corresponding ecosystem.
 * @returns A Promise that resolves when diagnostics are completed.
 */
async function performDiagnostics(diagnosticFilePath: string, contents: string, provider: IImageProvider) {
    try {        
        const images = await provider.collect(contents);
        const imageMap = new ImageMap(images);

        const diagnosticsPipeline = new DiagnosticsPipeline(imageMap, diagnosticFilePath);
        diagnosticsPipeline.clearDiagnostics();

        const response = await executeImageAnalysis(diagnosticFilePath, images);

        clearCodeActionsMap(diagnosticFilePath);

        diagnosticsPipeline.runDiagnostics(response.images);

        diagnosticsPipeline.reportDiagnostics();

    } catch (error) {
        connection.console.warn(`Component Analysis Error: ${error}`);
        connection.sendNotification('caError', {
            errorMessage: error.message,
            uri: decodeUriPath(diagnosticFilePath),
        });
    }
}

export { performDiagnostics };