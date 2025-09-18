import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BackupValidationResult,
  getBackupInfo,
  importDataFromBackup,
  ImportOptions,
  pickBackupFile,
  validateBackupFile,
} from '../services/dataBackupService';

interface DataImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (importedData: { books: number; sessions: number }) => void;
}

type ImportStep = 'select' | 'validate' | 'configure' | 'import' | 'complete';

export default function DataImportModal({ visible, onClose, onSuccess }: DataImportModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<ImportStep>('select');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mode: 'merge',
    validateIntegrity: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [importResult, setImportResult] = useState<{ books: number; sessions: number } | null>(null);

  const resetState = () => {
    setCurrentStep('select');
    setSelectedFileUri(null);
    setValidationResult(null);
    setBackupInfo(null);
    setImportOptions({ mode: 'merge', validateIntegrity: true });
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingMessage('');
    setImportResult(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetState();
      onClose();
    }
  };

  const handleFileSelect = async () => {
    setIsProcessing(true);
    setProcessingMessage(t('dataBackup.import.steps.select.buttons.selectFile'));

    try {
      const result = await pickBackupFile();
      
      if (result.success && result.fileUri) {
        setSelectedFileUri(result.fileUri);
        setProcessingMessage(t('dataBackup.import.steps.validate.validating'));
        
        // Validate the file
        const validation = await validateBackupFile(result.fileUri);
        setValidationResult(validation);
        
        if (validation.isValid) {
          // Get detailed info
          const info = await getBackupInfo(result.fileUri);
          if (info.success) {
            setBackupInfo(info.info);
          }
          setCurrentStep('validate');
        } else {
          Alert.alert(
            t('dataBackup.import.steps.validate.invalid'),
            `The selected file is not a valid PageStreak backup:\n\n${validation.errors.join('\n')}`,
            [{ text: t('dataBackup.import.buttons.ok'), onPress: () => setCurrentStep('select') }]
          );
        }
      } else {
        if (result.error && !result.error.includes('cancelled')) {
          Alert.alert(t('dataBackup.import.messages.failedToSelect'), result.error);
        }
      }
    } catch (error) {
      Alert.alert(t('dataBackup.import.messages.error'), error instanceof Error ? error.message : t('dataBackup.import.messages.failedToSelect'));
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleValidationNext = () => {
    if (validationResult?.warnings.length) {
      Alert.alert(
        t('dataBackup.import.steps.validate.warnings'),
        t('dataBackup.import.steps.validate.warningsMessage', { warnings: validationResult.warnings.join('\n') }),
        [
          { text: t('dataBackup.import.buttons.cancel'), style: 'cancel' },
          { text: t('dataBackup.import.buttons.continue'), onPress: () => setCurrentStep('configure') },
        ]
      );
    } else {
      setCurrentStep('configure');
    }
  };

  const handleImport = async () => {
    if (!selectedFileUri) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage(t('dataBackup.import.steps.import.importing'));
    setCurrentStep('import');

    try {
      // Show warning for replace mode
      if (importOptions.mode === 'replace') {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            t('dataBackup.import.messages.replaceConfirmTitle'),
            t('dataBackup.import.messages.replaceConfirmMessage'),
            [
              { text: t('dataBackup.import.buttons.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('dataBackup.import.buttons.replace'), style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

        if (!confirmed) {
          setCurrentStep('configure');
          setIsProcessing(false);
          return;
        }
      }

      const result = await importDataFromBackup(
        selectedFileUri,
        importOptions,
        (progress, message) => {
          setProcessingProgress(progress);
          setProcessingMessage(message);
        }
      );

      if (result.success) {
        setImportResult(result.imported);
        setCurrentStep('complete');
        onSuccess?.(result.imported);
      } else {
        Alert.alert(t('dataBackup.import.messages.error'), result.error || t('dataBackup.import.messages.unknownError'));
        setCurrentStep('configure');
      }
    } catch (error) {
      Alert.alert(t('dataBackup.import.messages.error'), error instanceof Error ? error.message : t('dataBackup.import.messages.unknownError'));
      setCurrentStep('configure');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingMessage('');
    }
  };

  const renderSelectStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="document" size={48} color="#6C63FF" />
        <Text style={styles.stepTitle}>{t('dataBackup.import.steps.select.title')}</Text>
        <Text style={styles.stepDescription}>
          {t('dataBackup.import.steps.select.subtitle')}
        </Text>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>{t('dataBackup.import.steps.select.instructions.title')}</Text>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.instructionText}>{t('dataBackup.import.steps.select.instructions.fileType')}</Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.instructionText}>{t('dataBackup.import.steps.select.instructions.version')}</Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={styles.instructionText}>{t('dataBackup.import.steps.select.instructions.source')}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isProcessing && styles.disabledButton]}
        onPress={handleFileSelect}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.primaryButtonText}>{processingMessage}</Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{t('dataBackup.import.steps.select.buttons.selectFile')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderValidateStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.stepTitle}>{t('dataBackup.import.steps.validate.valid')}</Text>
        <Text style={styles.stepDescription}>
          Your backup file is valid and ready to import
        </Text>
      </View>

      {backupInfo && (
        <View style={styles.backupInfoCard}>
          <Text style={styles.backupInfoTitle}>{t('dataBackup.import.steps.validate.backupInfo.title')}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dataBackup.import.steps.validate.backupInfo.created')}</Text>
            <Text style={styles.infoValue}>
              {new Date(backupInfo.createdAt).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dataBackup.import.steps.validate.backupInfo.books')}</Text>
            <Text style={styles.infoValue}>{backupInfo.totalBooks}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dataBackup.import.steps.validate.backupInfo.sessions')}</Text>
            <Text style={styles.infoValue}>{backupInfo.totalSessions}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dataBackup.import.steps.validate.backupInfo.fileSize')}</Text>
            <Text style={styles.infoValue}>{backupInfo.fileSize}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('dataBackup.import.steps.validate.backupInfo.userPreferences')}</Text>
            <Text style={styles.infoValue}>
              {backupInfo.hasUserPreferences ? t('dataBackup.import.steps.validate.backupInfo.included') : t('dataBackup.import.steps.validate.backupInfo.notIncluded')}
            </Text>
          </View>
        </View>
      )}

      {validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>{t('dataBackup.import.steps.validate.warnings')}</Text>
            {validationResult.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCurrentStep('select')}
        >
          <Text style={styles.secondaryButtonText}>{t('dataBackup.import.steps.configure.buttons.chooseDifferentFile')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleValidationNext}
        >
          <Text style={styles.primaryButtonText}>{t('dataBackup.import.buttons.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfigureStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="settings" size={48} color="#6C63FF" />
        <Text style={styles.stepTitle}>{t('dataBackup.import.steps.configure.title')}</Text>
        <Text style={styles.stepDescription}>
          {t('dataBackup.import.steps.configure.subtitle')}
        </Text>
      </View>

      <View style={styles.optionsCard}>
        <Text style={styles.optionsTitle}>{t('dataBackup.import.steps.configure.importMode')}</Text>
        
        <TouchableOpacity
          style={[
            styles.optionButton,
            importOptions.mode === 'merge' && styles.optionButtonSelected
          ]}
          onPress={() => setImportOptions(prev => ({ ...prev, mode: 'merge' }))}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionHeader}>
              <Ionicons 
                name="git-merge" 
                size={20} 
                color={importOptions.mode === 'merge' ? '#6C63FF' : '#6B7280'} 
              />
              <Text style={[
                styles.optionTitle,
                importOptions.mode === 'merge' && styles.optionTitleSelected
              ]}>
                {t('dataBackup.import.steps.configure.options.merge')} (Recommended)
              </Text>
            </View>
            <Text style={styles.optionDescription}>
              {t('dataBackup.import.steps.configure.options.mergeDescription')}
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            importOptions.mode === 'merge' && styles.radioButtonSelected
          ]}>
            {importOptions.mode === 'merge' && (
              <View style={styles.radioButtonInner} />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionButton,
            importOptions.mode === 'replace' && styles.optionButtonSelected
          ]}
          onPress={() => setImportOptions(prev => ({ ...prev, mode: 'replace' }))}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionHeader}>
              <Ionicons 
                name="refresh" 
                size={20} 
                color={importOptions.mode === 'replace' ? '#6C63FF' : '#6B7280'} 
              />
              <Text style={[
                styles.optionTitle,
                importOptions.mode === 'replace' && styles.optionTitleSelected
              ]}>
                {t('dataBackup.import.steps.configure.options.replace')}
              </Text>
            </View>
            <Text style={styles.optionDescription}>
              {t('dataBackup.import.steps.configure.options.replaceDescription')}
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            importOptions.mode === 'replace' && styles.radioButtonSelected
          ]}>
            {importOptions.mode === 'replace' && (
              <View style={styles.radioButtonInner} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {importOptions.mode === 'replace' && (
        <View style={styles.dangerCard}>
          <Ionicons name="warning" size={20} color="#EF4444" />
          <Text style={styles.dangerText}>
            {t('dataBackup.import.steps.configure.warningText')}
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCurrentStep('validate')}
        >
          <Text style={styles.secondaryButtonText}>{t('dataBackup.import.steps.configure.buttons.back')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleImport}
        >
          <Text style={styles.primaryButtonText}>
            {importOptions.mode === 'replace' ? t('dataBackup.import.buttons.replace') : t('dataBackup.import.buttons.import')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImportStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.stepTitle}>{t('dataBackup.import.steps.import.importingTitle')}</Text>
        <Text style={styles.stepDescription}>
          {t('dataBackup.import.steps.import.importingDescription')}
        </Text>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${processingProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{processingMessage}</Text>
        <Text style={styles.progressPercentage}>{Math.round(processingProgress)}%</Text>
      </View>

      <View style={styles.importWarning}>
        <Ionicons name="information-circle" size={20} color="#F59E0B" />
        <Text style={styles.importWarningText}>
          {t('dataBackup.import.steps.import.importWarning')}
        </Text>
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.stepTitle}>{t('dataBackup.import.steps.import.completeTitle')}</Text>
        <Text style={styles.stepDescription}>
          {t('dataBackup.import.steps.import.completeDescription')}
        </Text>
      </View>

      {importResult && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>{t('dataBackup.import.steps.import.importSummary')}</Text>
          
          <View style={styles.successRow}>
            <Ionicons name="library" size={20} color="#10B981" />
            <Text style={styles.successText}>
              {t('dataBackup.import.steps.import.booksImported', { count: importResult.books })}
            </Text>
          </View>
          
          <View style={styles.successRow}>
            <Ionicons name="time" size={20} color="#10B981" />
            <Text style={styles.successText}>
              {t('dataBackup.import.steps.import.sessionsImported', { count: importResult.sessions })}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleClose}
      >
        <Text style={styles.primaryButtonText}>{t('dataBackup.import.buttons.finish')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select':
        return renderSelectStep();
      case 'validate':
        return renderValidateStep();
      case 'configure':
        return renderConfigureStep();
      case 'import':
        return renderImportStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderSelectStep();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleClose} 
            style={styles.closeButton}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={24} color="#6C63FF" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('dataBackup.import.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    paddingVertical: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
  },
  backupInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  backupInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  warningContent: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
  },
  optionButtonSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#F8FAFF',
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  optionTitleSelected: {
    color: '#6C63FF',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: '#6C63FF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C63FF',
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  dangerText: {
    fontSize: 14,
    color: '#DC2626',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  importWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importWarningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 12,
    flex: 1,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 16,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    color: '#166534',
    marginLeft: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
});