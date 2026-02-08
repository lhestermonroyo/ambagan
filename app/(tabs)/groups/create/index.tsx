import Avatar from '@/components/_Avatar';
import FormButton from '@/components/FormButton';
import FormInput from '@/components/FormInput';
import FormTextarea from '@/components/FormTextarea';
import Icon from '@/components/Icon';
import SearchInput from '@/components/SearchInput';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Pressable } from '@/components/ui/pressable';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { VStack } from '@/components/ui/vstack';
import UploadCoverPhoto from '@/components/UploadCoverPhoto';
import { User } from '@/types/auth';
import { categories } from '@/utils/constants';
import { mockUsers } from '@/utils/data';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';

export default function CreateGroupScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [values, setValues] = useState({
    name: '',
    description: '',
    cover: null as string | null,
    category: ''
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    category: ''
  }) as any;
  const [members, setMembers] = useState<string[]>([]);

  const handleSelectMember = (userId: string) => {
    if (members.includes(userId)) {
      setMembers(members.filter((id) => id !== userId));
    } else {
      setMembers([...members, userId]);
    }
  };

  const handleSubmit = () => {
    if (!values.name) {
      setFormErrors((prev: any) => ({ ...prev, name: 'Name is required' }));
      return;
    }
    if (!values.category) {
      setFormErrors((prev: any) => ({
        ...prev,
        category: 'Category is required'
      }));
      return;
    }
  };

  if (step === 2) {
    return (
      <SelectMembersStep
        onSelect={handleSelectMember}
        onRemoveAll={() => setMembers([])}
        members={members}
        onBack={() => setStep(1)}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <KeyboardAvoidingView className="bg-primary-0 flex-1" behavior="padding">
      <Box className="sticky top-0 bg-white px-4 pb-4 pt-20 border-b border-background-100">
        <HStack className="items-center justify-between">
          <Button
            variant="link"
            className="rounded-full h-[18] w-[18]"
            onPress={() => router.back()}
          >
            <Icon as={ArrowLeft} className="text-secondary-950" />
          </Button>
          <Text bold className="flex-1 text-center text-xl">
            Create New Group
          </Text>
          <Box className="w-6" />
        </HStack>
      </Box>
      <ScrollView>
        <VStack className="gap-y-6 p-4">
          <UploadCoverPhoto
            onSelect={(uri) => setValues({ ...values, cover: uri })}
          />

          <FormInput
            type="text"
            label="Name"
            placeholder="Enter name (e.g. Japan 2026)"
            value={values.name}
            onChangeText={(text) => setValues({ ...values, name: text })}
            autoCapitalize="none"
            errorMessage={formErrors.name}
          />
          <FormTextarea
            label="Description"
            placeholder="Enter description"
            value={values.description}
            onChangeText={(text) => setValues({ ...values, description: text })}
            autoCapitalize="none"
            errorMessage={formErrors.description}
          />
          <FormControl size="md">
            <FormControlLabel>
              <FormControlLabelText>Category</FormControlLabelText>
            </FormControlLabel>
            <HStack className="gap-2 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  size="lg"
                  variant={
                    values.category === category.value ? 'solid' : 'outline'
                  }
                  onPress={() =>
                    setValues({ ...values, category: category.value })
                  }
                  className={`items-center px-4 rounded-full ${
                    values.category === category.value
                      ? 'border-primary-500'
                      : 'border-secondary-800 bg-white'
                  }`}
                >
                  <ButtonText
                    className={
                      values.category === category.value
                        ? 'text-white'
                        : 'text-inherit'
                    }
                  >
                    {category.label} {category.emoji}
                  </ButtonText>
                </Button>
              ))}
            </HStack>
          </FormControl>
        </VStack>
      </ScrollView>
      <HStack className="sticky bottom-0 bg-white px-4 pt-4 pb-10 border-t border-background-100">
        <FormButton
          className="flex-1"
          text="Continue"
          disabled={!values.name || !values.category}
          onPress={() => setStep(2)}
        />
      </HStack>
    </KeyboardAvoidingView>
  );
}

function SelectMembersStep({
  onSelect,
  onRemoveAll,
  onSubmit,
  onBack,
  members
}: {
  onSelect: (userId: string) => void;
  onRemoveAll: () => void;
  onSubmit: () => void;
  onBack: () => void;
  members: string[];
}) {
  const [tab, setTab] = useState<'all' | 'favorites'>('all');

  const formattedMembers = useMemo(() => {
    return members.map((id) => mockUsers.find((user) => user.id === id)!);
  }, [members]);

  return (
    <KeyboardAvoidingView className="bg-primary-0 flex-1" behavior="padding">
      <Box className="sticky top-0 bg-white px-4 pb-4 pt-20 border-b border-background-100">
        <VStack className="gap-y-4">
          <HStack className="items-center justify-between">
            <Button
              variant="link"
              className="rounded-full h-[18] w-[18]"
              onPress={onBack}
            >
              <Icon as={ArrowLeft} className="text-secondary-950" />
            </Button>
            <Text bold className="flex-1 text-center text-xl">
              Select Members
            </Text>
            <Box className="w-6" />
          </HStack>
          <SearchInput
            placeholder="Search members"
            value=""
            onChangeText={() => {}}
          />
          {formattedMembers.length > 0 ? (
            <VStack className="gap-y-2">
              <HStack>
                <Text className="text-secondary-950 flex-1">
                  {formattedMembers.length} member
                  {formattedMembers.length > 1 ? 's' : ''} selected
                </Text>
                <Pressable onPress={onRemoveAll}>
                  <Text className="text-primary-400">Remove All</Text>
                </Pressable>
              </HStack>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <HStack className="gap-x-4 py-2">
                  {formattedMembers.map((user) => (
                    <Pressable key={user.id} onPress={() => onSelect(user.id)}>
                      <Box className="absolute right-0 bottom-0 z-10 bg-primary-400 rounded-full p-1">
                        <Icon as={X} size={12} className="text-current" />
                      </Box>
                      <Avatar
                        name={user.first_name}
                        uri={user.avatar!}
                        size="lg"
                        className="rounded-full p-1 bg-primary-400"
                      />
                    </Pressable>
                  ))}
                </HStack>
              </ScrollView>
            </VStack>
          ) : (
            <Text className="text-secondary-950">No members selected yet.</Text>
          )}
          <HStack className="gap-x-2">
            <FormButton
              variant={tab === 'all' ? 'solid' : 'outline'}
              className="flex-1"
              text="All"
              onPress={() => setTab('all')}
            />
            <FormButton
              variant={tab === 'favorites' ? 'solid' : 'outline'}
              className="flex-1"
              text="Favorites"
              onPress={() => setTab('favorites')}
            />
          </HStack>
        </VStack>
      </Box>
      <VirtualizedList
        data={tab === 'all' ? mockUsers : []}
        keyExtractor={(item) => item.id.toString()}
        getItemCount={(data) => data.length}
        getItem={(data, index) => data[index]}
        renderItem={({ item }: { item: User }) => (
          <MemberItem
            user={item}
            onSelect={onSelect}
            isSelected={formattedMembers.some((u) => u.id === item.id)}
          />
        )}
        ItemSeparatorComponent={() => <Divider className="bg-secondary-100" />}
        className="flex-1 m-4 rounded-lg bg-white"
      />
      <HStack className="sticky bottom-0 bg-white px-4 pt-4 pb-10 border-t border-background-100">
        <FormButton
          className="flex-1"
          text="Create Group"
          disabled={members.length === 0}
          onPress={onSubmit}
        />
      </HStack>
    </KeyboardAvoidingView>
  );
}

function MemberItem({
  user,
  onSelect,
  isSelected
}: {
  user: User;
  onSelect: (userId: string) => void;
  isSelected: boolean;
}) {
  return (
    <Pressable className="p-4" onPress={() => onSelect(user.id)}>
      <HStack className="gap-x-4 justify-center items-center">
        <Avatar name={user.first_name} uri={user.avatar!} size="md" />
        <VStack className="flex-1">
          <Text className="text-lg">
            {user.first_name} {user.last_name}
          </Text>
          <Text className="text-secondary-950">{user.email}</Text>
        </VStack>
        <Icon
          as={Check}
          className={isSelected ? 'text-primary-400' : 'text-white'}
        />
      </HStack>
    </Pressable>
  );
}
